import type { CorsOptions } from 'cors';

const defaultOrigins: string[] = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildOrigin(): CorsOptions['origin'] {
  const fromEnv = parseList(process.env.CORS_ORIGIN);
  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const isProduction = process.env.NODE_ENV === 'production';

  const allowed = new Set<string>([...fromEnv]);
  if (appUrl) allowed.add(appUrl);
  if (!isProduction) {
    for (const origin of defaultOrigins) allowed.add(origin);
  }

  if (allowed.size === 0) {
    return true;
  }

  const list = Array.from(allowed);
  return (origin, callback) => {
    if (!origin || list.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  };
}

export const corsConfig: CorsOptions = {
  origin: buildOrigin(),
  credentials: true,
};
