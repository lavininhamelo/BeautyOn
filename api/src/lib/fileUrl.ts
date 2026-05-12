export function fileUrlForId(id: number): string {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, '') ?? '';
  return `${base}/files/${id}`;
}

export function withFileUrl<T extends { id: number; name: string }>(
  file: T
): T & { url: string } {
  return { ...file, url: fileUrlForId(file.id) };
}
