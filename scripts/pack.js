#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const deployDir = resolve(root, 'deploy');

const shouldZip = process.argv.includes('--zip');

if (!existsSync(join(root, 'api/dist'))) {
  console.error('[pack] api/dist not found. Run `npm run build` first.');
  process.exit(1);
}
if (!existsSync(join(root, 'api/dist/public'))) {
  console.error('[pack] api/dist/public not found. Run `npm run build` first.');
  process.exit(1);
}

let preservedEnv = null;
const existingEnv = join(deployDir, '.env');
if (existsSync(existingEnv)) {
  preservedEnv = readFileSync(existingEnv);
  console.log('[pack] preserving existing deploy/.env');
}

console.log('[pack] cleaning', deployDir);
rmSync(deployDir, { recursive: true, force: true });
mkdirSync(deployDir, { recursive: true });

if (preservedEnv) {
  writeFileSync(existingEnv, preservedEnv);
}

const filesToCopy = [
  ['server.js', 'server.js'],
  ['scripts/bootstrap.js', 'scripts/bootstrap.js'],
  ['api/dist', 'api/dist'],
  ['api/prisma', 'api/prisma'],
];

for (const [src, dest] of filesToCopy) {
  const from = join(root, src);
  const to = join(deployDir, dest);
  if (!existsSync(from)) {
    console.error(`[pack] missing: ${src}`);
    process.exit(1);
  }
  console.log(`[pack] copy ${src} -> deploy/${dest}`);
  cpSync(from, to, { recursive: true });
}

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const apiPkg = JSON.parse(readFileSync(join(root, 'api/package.json'), 'utf8'));

const slimPkg = {
  name: `${rootPkg.name}-deploy`,
  version: rootPkg.version,
  private: true,
  type: rootPkg.type,
  main: 'server.js',
  scripts: {
    start: 'node server.js',
    build: 'prisma migrate deploy --schema=api/prisma/schema.prisma',
    migrate: 'prisma migrate deploy --schema=api/prisma/schema.prisma',
  },
  dependencies: apiPkg.dependencies,
  engines: rootPkg.engines,
};

writeFileSync(join(deployDir, 'package.json'), JSON.stringify(slimPkg, null, 2) + '\n');
console.log('[pack] wrote slim package.json with', Object.keys(slimPkg.dependencies).length, 'deps');

const readme = `# BeautyOn - deploy bundle

This folder is ready to upload to Hostinger Node.js Apps.

## Contents

- \`server.js\` - entry point (loads env, runs prisma migrate deploy, boots Express)
- \`package.json\` - all production deps inlined; \`postinstall\` runs \`prisma generate\`
- \`api/dist/\` - compiled API + SPA build at \`api/dist/public/\`
- \`api/prisma/\` - schema + migrations

## Steps on Hostinger

1. Upload the contents of this folder to the application root.
2. **Environment Variables** (hPanel -> Node.js Apps): set \`DATABASE_URL\`, \`APP_SECRET\`, \`APP_URL\`, \`MAIL_*\`, etc. See \`.env.production.example\` in the repo for the full list. Alternatively drop a \`.env.production\` here with the same keys.
3. **Application startup file**: \`server.js\`
4. **Build command** (dropdown): pick \`npm run build\` (runs \`prisma migrate deploy\`).
5. Hostinger runs \`npm install\` automatically. No \`prisma generate\` needed — the Rust-free client is already bundled in \`api/dist/generated/prisma/\`.
6. Click **Start application**.

Set \`SKIP_MIGRATIONS=1\` if you ran the build command and don't want migrations to run again on boot.

## Test locally

\`\`\`bash
cd deploy
npm install         # installs deps + runs prisma generate
node server.js      # loads .env, migrates, boots on PORT (default 3000)
\`\`\`
`;
writeFileSync(join(deployDir, 'README.md'), readme);
console.log('[pack] wrote README.md');

const htaccess = `SetEnv NODE_OPTIONS "--max-old-space-size=512"
SetEnv LSNODE_CONSOLE_LOG console.log

PassengerAppType node
PassengerStartupFile server.js
`;
writeFileSync(join(deployDir, '.htaccess'), htaccess);
console.log('[pack] wrote .htaccess');

if (shouldZip) {
  const zipPath = resolve(root, 'beautyon-deploy.zip');
  rmSync(zipPath, { force: true });
  console.log(`[pack] zipping -> ${zipPath}`);
  const result = spawnSync('zip', ['-r', '-q', zipPath, '.', '-x', '.DS_Store'], {
    cwd: deployDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('[pack] zip failed');
    process.exit(result.status ?? 1);
  }
  console.log(`[pack] done -> ${zipPath}`);
} else {
  console.log(`[pack] done -> ${deployDir}`);
}
