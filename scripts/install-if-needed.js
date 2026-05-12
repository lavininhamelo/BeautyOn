#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('[install] usage: install-if-needed.js <dir1> [dir2] ...');
  process.exit(1);
}

const COLOR = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, text) => (useColor ? `${COLOR[color]}${text}${COLOR.reset}` : text);

function hashFile(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex');
}

function shouldInstall(dir) {
  const lockfile = join(dir, 'package-lock.json');
  const nodeModules = join(dir, 'node_modules');
  const stamp = join(nodeModules, '.install-stamp');

  if (!existsSync(lockfile)) {
    return { install: true, reason: 'no package-lock.json' };
  }
  if (!existsSync(nodeModules)) {
    return { install: true, reason: 'no node_modules' };
  }
  if (!existsSync(stamp)) {
    return { install: true, reason: 'no .install-stamp' };
  }

  const currentHash = hashFile(lockfile);
  const savedHash = readFileSync(stamp, 'utf8').trim();
  if (currentHash !== savedHash) {
    return { install: true, reason: 'lockfile changed' };
  }

  return { install: false, reason: 'up to date' };
}

function writeStamp(dir) {
  const lockfile = join(dir, 'package-lock.json');
  const stamp = join(dir, 'node_modules', '.install-stamp');
  if (existsSync(lockfile)) {
    writeFileSync(stamp, hashFile(lockfile));
  }
}

const start = Date.now();
for (const target of targets) {
  const dir = resolve(root, target);
  const label = c('cyan', `[install:${target}]`);

  const check = shouldInstall(dir);
  if (!check.install) {
    console.log(`${label} ${c('green', 'skip')} ${c('gray', check.reason)}`);
    continue;
  }

  console.log(`${label} ${c('yellow', 'running npm install')} ${c('gray', check.reason)}`);
  const t = Date.now();
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], {
    cwd: dir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`${label} npm install failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
  writeStamp(dir);
  console.log(`${label} ${c('green', 'done')} ${c('gray', `${Date.now() - t}ms`)}`);
}
console.log(c('gray', `[install] total ${Date.now() - start}ms`));
