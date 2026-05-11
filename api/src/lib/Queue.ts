import { Prisma } from '@prisma/client';
import CancellationMail from '../app/jobs/CancellationMail.js';
import { prisma } from './prisma.js';

type JobHandler = {
  key: string;
  handle: (payload: { data: unknown }) => Promise<unknown>;
};

const handlers: JobHandler[] = [CancellationMail];

const handlerByKey = new Map(handlers.map(h => [h.key, h]));

function pollIntervalMs(): number {
  const n = Number(process.env.QUEUE_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n >= 200 ? n : 2000;
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

class Queue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private started = false;

  async add(jobKey: string, data: object): Promise<void> {
    const maxAttempts = defaultMaxAttempts();
    await prisma.job.create({
      data: {
        jobKey,
        payload: data as Prisma.InputJsonValue,
        maxAttempts,
        status: 'queued',
        runAt: new Date(),
      },
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
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

      try {
        await handler.handle({ data: job.payload });
        await prisma.job.delete({ where: { id: job.id } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = job.attempts;
        if (attempts < job.maxAttempts) {
          const runAt = new Date(Date.now() + backoffMsAfterFailure(attempts));
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
      console.error('[BeautyOn] Queue tick error:', e);
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
