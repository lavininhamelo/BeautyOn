import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const thisFileDir = dirname(fileURLToPath(import.meta.url));

export const projectRoot: string = join(thisFileDir, '..', '..');

export const tmpUploadsDir: string = join(projectRoot, 'tmp', 'uploads');

function resolveWebBuildDir(): string | null {
  const fromEnv = process.env.WEB_BUILD_DIR?.trim();
  const candidates = [
    fromEnv ? resolve(fromEnv) : null,
    join(projectRoot, 'dist', 'public'),
    join(projectRoot, 'public'),
    join(projectRoot, '..', 'web', 'build'),
  ].filter((p): p is string => !!p);

  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) return p;
  }
  return null;
}

export const webBuildDir: string | null = resolveWebBuildDir();
