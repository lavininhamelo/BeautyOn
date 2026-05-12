type Level = 'info' | 'warn' | 'error' | 'debug' | 'http' | 'ready';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
} as const;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(color: keyof typeof COLORS, text: string): string {
  return useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

function ts(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

const LEVEL_TAGS: Record<Level, string> = {
  info: paint('cyan', 'info '),
  warn: paint('yellow', 'warn '),
  error: paint('red', 'error'),
  debug: paint('magenta', 'debug'),
  http: paint('blue', 'http '),
  ready: paint('green', 'ready'),
};

function formatArg(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a instanceof Error) {
    const extras: Record<string, unknown> = {};
    for (const k of Object.keys(a) as Array<keyof typeof a>) {
      const v = (a as unknown as Record<string, unknown>)[k as string];
      if (k === 'message' || k === 'stack' || k === 'name') continue;
      extras[k as string] = v;
    }
    const extrasStr = Object.keys(extras).length ? ` ${JSON.stringify(extras)}` : '';
    return `${a.name || 'Error'}: ${a.message}${extrasStr}\n${a.stack || ''}`;
  }
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function write(level: Level, args: unknown[]): void {
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const prefix = `${paint('gray', ts())} ${LEVEL_TAGS[level]} `;
  const text = args.map(formatArg).join(' ');
  out.write(prefix + text + '\n');
}

export const log = {
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      write('debug', args);
    }
  },
  ready: (...args: unknown[]) => write('ready', args),
  http: (method: string, path: string, status: number, durationMs: number) => {
    const statusColor: keyof typeof COLORS =
      status >= 500 ? 'red' : status >= 400 ? 'yellow' : status >= 300 ? 'cyan' : 'green';
    const line = `${method.padEnd(6)} ${path}  ${paint(statusColor, String(status))}  ${paint('gray', `${durationMs}ms`)}`;
    process.stdout.write(`${paint('gray', ts())} ${LEVEL_TAGS.http} ${line}\n`);
  },
  banner: (title: string, rows: Array<[string, string]>): void => {
    const pad = Math.max(...rows.map(([k]) => k.length));
    process.stdout.write(`\n${paint('bold', '┌─ ' + title + ' ' + '─'.repeat(Math.max(0, 50 - title.length)))}\n`);
    for (const [k, v] of rows) {
      process.stdout.write(`${paint('bold', '│ ')} ${paint('gray', k.padEnd(pad))}  ${v}\n`);
    }
    process.stdout.write(`${paint('bold', '└' + '─'.repeat(54))}\n\n`);
  },
};
