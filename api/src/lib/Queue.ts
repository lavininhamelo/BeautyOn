import { Prisma } from '../generated/prisma/client.js';
import CancellationMail from '../app/jobs/CancellationMail.js';
import { prisma } from './prisma.js';
import { log } from './logger.js';

type JobHandler = {
  key: string;
  handle: (payload: { data: unknown }) => Promise<unknown>;
};

const handlers: JobHandler[] = [CancellationMail];

const handlerByKey = new Map(handlers.map(h => [h.key, h]));

function pollIntervalMs(): number {
  const n = Number(process.env.QUEUE_POLL_INTERVAL_MS);
  if (Number.isFinite(n) && n >= 200) return n;
  return process.env.NODE_ENV === 'production' ? 10_000 : 2_000;
}

function defaultMaxAttempts(): number {
  const n = Number(process.env.QUEUE_MAX_ATTEMPTS);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 5;
}

function backoffMsAfterFailure(attempts: number): number {
  const baseSeconds = 30;
  const exp = Math.min(attempts, 10);
  return Math.min(2 ** exp * baseSeconds * 1000, 24 * 60 * 60 * 1000);
}

export function queueEnabled(): boolean {
  const v = process.env.QUEUE_ENABLED?.toLowerCase().trim();
  if (v === undefined) return true;
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
}

class Queue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private started = false;

  async add(jobKey: string, data: object): Promise<void> {
    if (!queueEnabled()) {
      const handler = handlerByKey.get(jobKey);
      if (!handler) {
        log.error(`queue: (disabled) unknown job key "${jobKey}", dropping payload`);
        return;
      }
      log.info(`queue: (disabled) running ${jobKey} inline`);
      try {
        await handler.handle({ data });
        log.ready(`queue: (disabled) ${jobKey} inline ok`);
      } catch (err) {
        log.error(`queue: (disabled) ${jobKey} inline failed`, err);
      }
      return;
    }
    const maxAttempts = defaultMaxAttempts();
    const job = await prisma.job.create({
      data: {
        jobKey,
        payload: data as Prisma.InputJsonValue,
        maxAttempts,
        status: 'queued',
        runAt: new Date(),
      },
    });
    log.info(`queue: enqueued #${job.id} key=${jobKey}`);
  }

  start(): void {
    if (this.started) return;
    if (!queueEnabled()) {
      log.warn('queue: worker disabled (QUEUE_ENABLED=0). Jobs run inline on Queue.add().');
      this.started = true;
      return;
    }
    this.started = true;
    log.ready(`queue: worker started (poll=${pollIntervalMs()}ms, maxAttempts=${defaultMaxAttempts()})`);
    void this.scheduleTick();
  }

  private scheduleTick(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick().finally(() => this.scheduleTick());
    }, pollIntervalMs());
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reclaimStaleProcessing();
      const job = await this.claimNextJob();
      if (!job) return;

      const handler = handlerByKey.get(job.jobKey);
      if (!handler) {
        log.error(`queue: unknown job key "${job.jobKey}" (job #${job.id})`);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lastError: `Unknown job key: ${job.jobKey}`,
            lockedAt: null,
          },
        });
        return;
      }

      log.info(`queue: processing #${job.id} key=${job.jobKey} attempt=${job.attempts}`);
      const startedAt = Date.now();
      try {
        await handler.handle({ data: job.payload });
        await prisma.job.delete({ where: { id: job.id } });
        log.ready(`queue: completed #${job.id} in ${Date.now() - startedAt}ms`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = job.attempts;
        if (attempts < job.maxAttempts) {
          const runAt = new Date(Date.now() + backoffMsAfterFailure(attempts));
          log.warn(`queue: failed #${job.id} (attempt ${attempts}/${job.maxAttempts}) - retry at ${runAt.toISOString()}: ${message}`);
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'queued',
              lastError: message,
              lockedAt: null,
              runAt,
            },
          });
        } else {
          log.error(`queue: gave up on #${job.id} after ${attempts} attempts: ${message}`);
          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              lastError: message,
              lockedAt: null,
            },
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const transient =
        msg.includes('timer has gone away') ||
        msg.includes("Can't reach database server") ||
        msg.includes('Connection refused') ||
        msg.includes('pool_timeout');
      if (transient) {
        log.warn(`queue: transient tick error (will retry next tick): ${msg.split('\n')[0]}`);
      } else {
        log.error('queue: tick error', e);
      }
    } finally {
      this.running = false;
    }
  }

  private async reclaimStaleProcessing(): Promise<void> {
    const threshold = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.job.updateMany({
      where: {
        status: 'processing',
        lockedAt: { lt: threshold },
      },
      data: {
        status: 'queued',
        lockedAt: null,
      },
    });
  }

  private async claimNextJob() {
    return prisma.$transaction(async tx => {
      const picked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM jobs
        WHERE status = 'queued' AND run_at <= NOW(3)
        ORDER BY run_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (!picked.length) return null;

      const id = picked[0].id;
      await tx.job.update({
        where: { id },
        data: {
          status: 'processing',
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      return tx.job.findUnique({ where: { id } });
    });
  }
}

export default new Queue();
