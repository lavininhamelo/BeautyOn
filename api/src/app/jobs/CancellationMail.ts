import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale/pt';
import Mail from '../../lib/Mail.js';

type JobData = {
  appointment: any;
};

class CancellationMail {
  get key() {
    return 'CancellationMail';
  }

  async handle({ data }: { data: unknown }) {
    const { appointment } = data as JobData;
    const d = appointment.date instanceof Date ? appointment.date : parseISO(String(appointment.date));

    return Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        user:
          appointment.user?.name ??
          ([appointment.guestName, appointment.guestPhone]
            .filter(Boolean)
            .join(' · ') || 'Cliente'),
        date: format(d, "dd 'de' MMMM 'às' HH:mm", { locale: pt }),
      },
    });
  }
}

export default new CancellationMail();
