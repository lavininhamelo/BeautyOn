import { isBefore, subHours } from 'date-fns';
import type { File } from '../generated/prisma/client.js';
import { fileUrlForId } from './fileUrl.js';

type ListRow = {
  id: number;
  date: Date;
  status?: string | null;
  canceledAt?: Date | null;
  providerService?: {
    id: number;
    name: string;
    durationMinutes: number;
    priceCents: number;
  } | null;
  provider: {
    id: number;
    name: string;
    avatar: Pick<File, 'id'> | null;
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
          price_cents: row.providerService.priceCents,
        }
      : null,
    provider: {
      id: row.provider.id,
      name: row.provider.name,
      avatar: row.provider.avatar
        ? {
            id: row.provider.avatar.id,
            url: fileUrlForId(row.provider.avatar.id),
          }
        : null,
    },
  };
}
