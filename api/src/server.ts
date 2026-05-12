import { mkdirSync } from 'node:fs';
import app from './app.js';
import { log } from './lib/logger.js';
import { sentryEnabled } from './config/sentry.js';
import { tmpUploadsDir } from './lib/paths.js';

function listenPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    log.warn(`invalid PORT="${raw}", using 3000`);
    return 3000;
  }
  return n;
}

const port = listenPort();
const explicitHost = process.env.LISTEN_HOST?.trim();

try {
  mkdirSync(tmpUploadsDir, { recursive: true });
} catch (e) {
  log.warn('could not create tmp uploads dir:', e);
}

log.info(`http: calling app.listen(${port}${explicitHost ? `, "${explicitHost}"` : ''})`);

function onReady(): void {
  log.banner('BeautyOn API ready', [
    ['bind', `${explicitHost || 'default'}:${port}`],
    ['env', process.env.NODE_ENV || 'development'],
    ['node', process.version],
    ['pid', String(process.pid)],
    ['sentry', sentryEnabled ? 'enabled' : 'disabled'],
    ['db', maskDbUrl(process.env.DATABASE_URL)],
    ['mail', maskMail(process.env.MAIL_HOST, process.env.MAIL_PORT, process.env.MAIL_USER)],
  ]);
  log.ready(`listening on port ${port}`);
}

const server = explicitHost
  ? app.listen(port, explicitHost, onReady)
  : app.listen(port, onReady);

server.on('error', err => {
  log.error('HTTP server listen error:', err);
  process.exit(1);
});

function maskDbUrl(url: string | undefined): string {
  if (!url) return 'not set';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function maskMail(host?: string, port?: string, user?: string): string {
  if (!host) return 'not configured';
  const u = (user || 'anon').split('@')[0];
  return `${u}@${host}:${port || '?'}`;
}

function shutdown(signal: NodeJS.Signals): void {
  log.warn(`received ${signal}, closing server...`);
  server.close(err => {
    if (err) {
      log.error('error during shutdown:', err);
      process.exit(1);
    }
    log.info('server closed');
    process.exit(0);
  });
  setTimeout(() => {
    log.error('graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', err => {
  log.error('uncaughtException:', err);
});
process.on('unhandledRejection', err => {
  log.error('unhandledRejection:', err);
});
