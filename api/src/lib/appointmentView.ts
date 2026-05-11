import { isBefore, subHours } from 'date-fns';
import type { File } from '@prisma/client';
import { fileUrlForPath } from './fileUrl.js';

type ListRow = {
  id: number;
  date: Date;
  status?: string | null;
  canceledAt?: Date | null;
  providerService?: {
    id: number;
    name: string;
    durationMinutes: number;
  } | null;
  provider: {
    id: number;
    name: string;
    avatar: Pick<File, 'id' | 'path'> | null;
  } | null;
};

export function appointmentListItem(row: ListRow) {
  if (!row.provider) {
    throw new Error('appointmentListItem: provider is required');
  }
  return {
    id: row.id,
    date: row.date,
    status: row.status ?? 'scheduled',
    canceled_at: row.canceledAt ? row.canceledAt.toISOString() : null,
    past: isBefore(row.date, new Date()),
    cancelable: isBefore(new Date(), subHours(row.date, 2)),
    service: row.providerService
      ? {
          id: row.providerService.id,
          name: row.providerService.name,
          duration_minutes: row.providerService.durationMinutes,
        }
      : null,
    provider: {
      id: row.provider.id,
      name: row.provider.name,
      avatar: row.provider.avatar
        ? {
            id: row.provider.avatar.id,
            path: row.provider.avatar.path,
            url: fileUrlForPath(row.provider.avatar.path),
          }
        : null,
    },
  };
}
