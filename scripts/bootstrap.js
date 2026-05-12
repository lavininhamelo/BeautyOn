import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (color, text) => (useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text);
const ts = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};
const log = {
  info: (...a) => console.log(paint('gray', ts()), paint('cyan', 'boot '), ...a),
  ready: (...a) => console.log(paint('gray', ts()), paint('green', 'ready'), ...a),
  warn: (...a) => console.warn(paint('gray', ts()), paint('yellow', 'warn '), ...a),
  error: (...a) => console.error(paint('gray', ts()), paint('red', 'error'), ...a),
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const startedAt = Date.now();

console.log('');
console.log(paint('bold', '  BeautyOn'), paint('gray', `boot ${new Date().toISOString()}`));
console.log('');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf8');
  let loaded = 0;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded++;
    }
  }
  log.info(`env: loaded ${loaded} vars from ${filePath.replace(rootDir, '.')}`);
  return true;
}

const envCandidates = [
  resolve(rootDir, '.env.production'),
  resolve(rootDir, '.env'),
  resolve(rootDir, 'api/.env'),
];
let envLoaded = false;
for (const candidate of envCandidates) {
  if (loadEnvFile(candidate)) {
    envLoaded = true;
    break;
  }
}
if (!envLoaded) {
  log.warn('env: no .env file found, relying on process.env from host');
}

function maskDbUrl(url) {
  if (!url) return '(empty)';
  try {
    const u = new URL(url);
    const user = u.username || '(no-user)';
    const host = u.host || '(no-host)';
    const db = u.pathname.replace(/^\//, '') || '(no-db)';
    return `${u.protocol}//${user}:***@${host}/${db}`;
  } catch {
    return `(unparseable: ${url.slice(0, 30)}...)`;
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  log.warn('env: DATABASE_URL is empty — app will fail until it is set');
} else {
  log.info(`env: DATABASE_URL = ${maskDbUrl(process.env.DATABASE_URL)}`);
}

process.on('uncaughtException', err => {
  console.error(ts(), paint('red', 'FATAL'), 'uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error(ts(), paint('yellow', 'warn '), 'unhandledRejection:', err);
});

const apiDist = resolve(rootDir, 'api/dist/server.js');
if (!existsSync(apiDist)) {
  log.error('api/dist/server.js not found. Run `npm run build` first.');
  process.exit(1);
}

const rootPrisma = resolve(rootDir, 'node_modules/.bin/prisma');
const apiPrisma = resolve(rootDir, 'api/node_modules/.bin/prisma');

let prismaCwd;
let schemaRel;
let prismaMode;
if (existsSync(rootPrisma)) {
  prismaCwd = rootDir;
  schemaRel = 'api/prisma/schema.prisma';
  prismaMode = 'deploy-bundle';
} else if (existsSync(apiPrisma)) {
  prismaCwd = resolve(rootDir, 'api');
  schemaRel = 'prisma/schema.prisma';
  prismaMode = 'source-tree';
}

if (prismaMode) {
  log.info(`prisma: detected ${prismaMode} layout (schema=${schemaRel})`);

  const isProd = process.env.NODE_ENV === 'production';
  const skipMigrations =
    process.env.SKIP_MIGRATIONS === '1' || (isProd && process.env.RUN_MIGRATIONS_ON_BOOT !== '1');

  if (skipMigrations) {
    if (isProd) {
      log.info('migrations: skipped at boot (run via build command, or set RUN_MIGRATIONS_ON_BOOT=1)');
    } else {
      log.warn('migrations: SKIP_MIGRATIONS=1, skipping prisma migrate deploy');
    }
  } else {
    const pkgJsonForPrisma = resolve(prismaCwd, 'package.json');
    let prismaCliPath = null;
    if (existsSync(pkgJsonForPrisma)) {
      try {
        const req = createRequire(pkgJsonForPrisma);
        prismaCliPath = req.resolve('prisma/build/index.js');
      } catch {
        const fallback = resolve(prismaCwd, 'node_modules/prisma/build/index.js');
        if (existsSync(fallback)) prismaCliPath = fallback;
      }
    }
    const absSchema = resolve(prismaCwd, schemaRel);

    if (!prismaCliPath || !existsSync(absSchema)) {
      log.warn('migrations: prisma cli/schema not found, skipping');
    } else {
      log.info('migrations: running prisma migrate deploy...');
      const migrateStart = Date.now();
      const migrate = spawnSync(
        process.execPath,
        [prismaCliPath, 'migrate', 'deploy', `--schema=${absSchema}`],
        { cwd: prismaCwd, stdio: 'inherit', env: process.env },
      );
      if (migrate.error?.code === 'EAGAIN') {
        log.warn('migrations: host refused to spawn (EAGAIN). Use build command instead. Starting anyway.');
      } else if (migrate.error || migrate.signal || migrate.status !== 0) {
        log.error(`migrations: prisma migrate deploy failed (${migrate.error?.message || `exit ${migrate.status} signal ${migrate.signal}`})`);
        process.exit(migrate.status ?? 1);
      } else {
        log.ready(`migrations: done in ${Date.now() - migrateStart}ms`);
      }
    }
  }
} else {
  log.warn('prisma: no installation found (skipping migrate)');
}

log.info(`bootstrap: done in ${Date.now() - startedAt}ms`);
