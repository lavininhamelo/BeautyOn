import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const thisFileDir = dirname(fileURLToPath(import.meta.url));

export const projectRoot: string = join(thisFileDir, '..', '..');

export const tmpUploadsDir: string = join(projectRoot, 'tmp', 'uploads');
