#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, '..');
const apiDir = resolve(repoRoot, 'api');
const webDir = resolve(repoRoot, 'web');

const procs = [];

function colorize(label, color) {
  const colors = { cyan: 36, magenta: 35, yellow: 33 };
  const code = colors[color] ?? 37;
  return `\x1b[${code}m[${label}]\x1b[0m`;
}

function startProc({ name, color, cwd, cmd, args }) {
  const tag = colorize(name, color);
  const child = spawn(cmd, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const prefix = (stream, isErr) => {
    stream.setEncoding('utf8');
    let buf = '';
    stream.on('data', chunk => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        (isErr ? process.stderr : process.stdout).write(`${tag} ${line}\n`);
      }
    });
    stream.on('end', () => {
      if (buf) (isErr ? process.stderr : process.stdout).write(`${tag} ${buf}\n`);
    });
  };

  prefix(child.stdout, false);
  prefix(child.stderr, true);

  child.on('exit', code => {
    process.stdout.write(`${tag} exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  procs.push(child);
}

function shutdown(code = 0) {
  for (const p of procs) {
    if (!p.killed) {
      try { p.kill('SIGTERM'); } catch {}
    }
  }
  setTimeout(() => process.exit(code), 200).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProc({
  name: 'api',
  color: 'cyan',
  cwd: apiDir,
  cmd: 'npm',
  args: ['run', 'dev'],
});

startProc({
  name: 'web',
  color: 'magenta',
  cwd: webDir,
  cmd: 'npm',
  args: ['run', 'start'],
});

process.stdout.write(
  `${colorize('dev', 'yellow')} api: http://localhost:3000  web: http://localhost:8080\n`,
);
