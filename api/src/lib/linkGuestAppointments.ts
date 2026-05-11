import { prisma } from './prisma.js';

export async function attachGuestAppointmentsToUser(
  userId: number,
  normalizedPhone: string,
): Promise<number> {
  const res = await prisma.appointment.updateMany({
    where: {
      userId: null,
      guestPhone: normalizedPhone,
      date: { gt: new Date() },
      status: 'scheduled',
      canceledAt: null,
    },
    data: {
      userId,
      guestName: null,
      guestPhone: null,
    },
  });
  return res.count;
}
