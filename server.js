#!/usr/bin/env node
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const f of ['.env.production', '.env', 'api/.env']) {
  const fp = resolve(__dirname, f);
  if (!existsSync(fp)) continue;
  for (const line of readFileSync(fp, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
  break;
}

process.on('uncaughtException', err => console.error('[server] uncaughtException:', err?.stack || err));
process.on('unhandledRejection', err => console.error('[server] unhandledRejection:', err?.stack || err));

const PORT = Number(process.env.PORT) || 3000;
const inPassenger = typeof globalThis.PhusionPassenger !== 'undefined';
console.log(`[server] starting pid=${process.pid} node=${process.version} passenger=${inPassenger} port=${PORT}`);

// While the real app loads, respond 200 immediately so LSWS probe doesn't time out
const BOOTING_HTML = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="3"><title>BeautyOn – a iniciar…</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fdf2f8;color:#4a1942}p{font-size:1.2rem}</style>
</head><body><p>⏳ A iniciar… a página atualiza automaticamente.</p></body></html>`;

let appHandler = null;
let appLoadError = null;

const server = createServer((req, res) => {
  if (appLoadError) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('BeautyOn API failed to start. Check server logs.');
    return;
  }
  if (appHandler) {
    try {
      appHandler(req, res);
    } catch (err) {
      console.error('[server] handler threw:', err?.stack || err);
      if (!res.headersSent) { res.writeHead(500); res.end('internal error'); }
    }
    return;
  }
  // App still loading — respond 200 so LSWS probe succeeds
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(BOOTING_HTML);
});

server.on('error', err => { console.error('[server] listen error:', err?.stack || err); process.exit(1); });

function onListening() {
  const addr = server.address();
  console.log(`[server] LISTENING on ${typeof addr === 'string' ? addr : `${addr?.address}:${addr?.port}`}`);
}

if (inPassenger) {
  server.listen('passenger', onListening);
} else {
  server.listen(PORT, onListening);
}

console.log('[server] socket open, loading real app in background...');

import('./api/dist/app.js')
  .then(mod => {
    appHandler = mod.default;
    console.log('[server] app attached — ready to serve real requests');
  })
  .catch(err => {
    appLoadError = err;
    console.error('[server] FAILED to load app:', err?.stack || err);
  });

function shutdown(signal) {
  console.log(`[server] received ${signal}, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
