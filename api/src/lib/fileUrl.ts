export function fileUrlForPath(path: string): string {
  const base = process.env.APP_URL ?? '';
  return `${base}/files/${path}`;
}

export function withFileUrl<T extends { id: number; path: string; name: string }>(
  file: T
): T & { url: string } {
  return { ...file, url: fileUrlForPath(file.path) };
}
