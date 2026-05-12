import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import pt from 'date-fns/locale/pt';
import moment from 'moment';
import 'moment/locale/pt';
import type { CalendarProps, ToolbarProps } from 'react-big-calendar';
import {
  momentLocalizer,
  SlotInfo,
  View,
  Views,
} from 'react-big-calendar';

import { FiClock } from 'react-icons/fi';
import { Link, useHistory } from 'react-router-dom';

import ShadcnBigCalendar from '../../components/shadcn-big-calendar/shadcn-big-calendar';
import ProviderCalendarToolbar from '../../components/ProviderCalendarToolbar';
import BookingWizard from '../../components/BookingWizard';
import { Modal } from '../../components/ui/modal';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';
import api from '../../services/api';
import Avatar from '../../components/Avatar';
import ProviderHeader from '../../components/ProviderHeader';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import {
  DEFAULT_PROVIDER_ALLOWED_HOURS,
  overridesArrayToMap,
  effectiveHoursServerOnly,
  isSlotAllowedForProvider,
} from '../../utils/providerScheduleEffective';
import type { ScheduleConfigResponse, WeeklyMap } from '../../utils/providerScheduleEffective';

moment.locale('pt');
const localizer = momentLocalizer(moment);

type AppointmentStatus = 'scheduled' | 'attended' | 'canceled' | 'no_show';

interface DashboardRow {
  id: number | string;
  date: string;
  hourFormatted: string;
  clientName: string;
  clientAvatar?: string;
  serviceId?: number | null;
  serviceName?: string | null;
  providerId?: number | null;
  status?: AppointmentStatus;
}

interface ProviderCalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: DashboardRow;
  variant?: 'primary' | 'secondary' | 'outline';
}

type ApiAppointment = {
  id: number;
  date: string;
  status: AppointmentStatus;
  provider_id: number | null;
  service_id: number | null;
  service_name: string | null;
  user: { name: string; avatar_url?: string };
};

function mapApiToRow(a: ApiAppointment): DashboardRow {
  return {
    id: a.id,
    date: String(a.date),
    hourFormatted: format(parseISO(String(a.date)), 'HH:mm', {
      locale: pt,
    }),
    clientName: a.user.name,
    clientAvatar: a.user.avatar_url,
    serviceId: a.service_id,
    serviceName: a.service_name,
    providerId: a.provider_id,
    status: a.status,
  };
}

function rowToCalendarEvent(row: DashboardRow): ProviderCalendarEvent {
  const start = parseISO(String(row.date));
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  let variant: ProviderCalendarEvent['variant'] = 'primary';
  if (row.status === 'attended') variant = 'secondary';
  if (row.status === 'canceled' || row.status === 'no_show') variant = 'outline';

  const title = row.serviceName
    ? `${row.clientName} — ${row.serviceName}`
    : row.clientName;

  return {
    title,
    start,
    end,
    resource: row,
    variant,
  };
}

function daysToFetchForView(view: View, anchor: Date): Date[] {
  if (view === Views.DAY) {
    return [anchor];
  }
  if (view === Views.WEEK) {
    return eachDayOfInterval({
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    });
  }
  if (view === Views.MONTH || view === Views.AGENDA) {
    return eachDayOfInterval({
      start: startOfMonth(anchor),
      end: endOfMonth(anchor),
    });
  }
  return eachDayOfInterval({
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  });
}

const selectCls =
  'rounded-lg border border-[var(--color-hard-gray)] bg-[var(--color-primary)] px-2.5 py-1.5 text-xs text-[var(--color-header-text)]';

type RowProps = {
  row: DashboardRow;
  statusUpdatingId: string | null;
  updateAppointmentStatus: (id: DashboardRow['id'], s: AppointmentStatus) => void;
  goToReschedule: (row: DashboardRow) => void;
};

const AppointmentRowBlock: React.FC<RowProps> = ({
  row,
  statusUpdatingId,
  updateAppointmentStatus,
  goToReschedule,
}) => (
  <div className="mt-4 flex items-center gap-6 first:mt-0">
    <span className="flex w-[110px] shrink-0 items-center text-[var(--color-text-white)]">
      <FiClock className="mr-2 text-[var(--color-primary)]" />
      {row.hourFormatted}
    </span>
    <Card className="min-w-0 flex-1 border-0 bg-[var(--color-shape)] shadow-none">
      <CardContent className="flex items-start gap-6 p-6">
        <Avatar
          name={row.clientName}
          src={row.clientAvatar}
          alt={row.clientName}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="text-xl text-[var(--color-text-white)]">
            {row.clientName}
          </strong>
          {row.serviceName && (
            <span className="text-[13px] text-[var(--color-light-gray)]">
              {row.serviceName}
            </span>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <select
              value={row.status ?? 'scheduled'}
              disabled={statusUpdatingId === String(row.id)}
              onChange={e =>
                updateAppointmentStatus(row.id, e.target.value as AppointmentStatus)
              }
              className={selectCls}
            >
              <option value="scheduled">Marcado</option>
              <option value="attended">Atendido</option>
              <option value="no_show">Ausente</option>
              <option value="canceled">Cancelado</option>
            </select>

            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-xs text-[var(--color-primary)] no-underline hover:underline"
              onClick={() => goToReschedule(row)}
            >
              Remarcar
            </Button>
          </div>
          <Link
            to={`/provider/appointments/${String(row.id)}/record`}
            className="mt-1 text-[13px] text-[var(--color-primary)] hover:underline"
          >
            Registar atendimento
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>
);

const calendarMessages = {
  allDay: 'Dia inteiro',
  previous: 'Período anterior',
  next: 'Período seguinte',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Marcação',
  showMore: (total: number) => `+${total} mais`,
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const history = useHistory();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookModalSlotStart, setBookModalSlotStart] = useState<Date | null>(
    null,
  );
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleRow, setRescheduleRow] = useState<DashboardRow | null>(null);
  const [scheduleRefresh, setScheduleRefresh] = useState(0);

  const [providerSchedule, setProviderSchedule] = useState<{
    weekly: WeeklyMap;
    allowedHours: string[];
    serverOverrides: Map<string, boolean>;
  } | null>(null);

  const [rangeAppointments, setRangeAppointments] = useState<DashboardRow[]>([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const goToReschedule = useCallback(
    (row: DashboardRow) => {
      const providerId = row.providerId ?? Number(user?.id);
      if (!providerId || Number.isNaN(providerId)) return;
      history.push(`/provider/reschedule/${row.id}`, {
        providerId,
        serviceId: row.serviceId ?? undefined,
        serviceName: row.serviceName ?? undefined,
      });
    },
    [history, user],
  );

  const updateAppointmentStatus = useCallback(
    async (appointmentId: DashboardRow['id'], next: AppointmentStatus) => {
      const id = String(appointmentId);
      const prevRow = rangeAppointments.find(a => String(a.id) === id);
      const prevStatus = prevRow?.status ?? 'scheduled';

      setRangeAppointments(prev =>
        prev.map(p => (String(p.id) === id ? { ...p, status: next } : p)),
      );

      setStatusUpdatingId(id);
      try {
        await api.patch(`/provider/appointments/${id}/status`, { status: next });
      } catch (err) {
        setRangeAppointments(prev =>
          prev.map(p => (String(p.id) === id ? { ...p, status: prevStatus } : p)),
        );
        addToast({
          type: 'error',
          title: 'Não foi possível alterar o status',
          description:
            (err as any)?.response?.data?.error ??
            'Tenta novamente dentro de momentos.',
        });
      } finally {
        setStatusUpdatingId(current => (current === id ? null : current));
      }
    },
    [addToast, rangeAppointments],
  );

  const scheduleQueryRange = useMemo(() => {
    const days = daysToFetchForView(calendarView, calendarDate);
    if (days.length === 0) {
      const t = new Date();
      return { from: format(t, 'yyyy-MM-dd'), to: format(t, 'yyyy-MM-dd') };
    }
    const times = days.map(d => d.getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    return {
      from: format(new Date(minT), 'yyyy-MM-dd'),
      to: format(new Date(maxT), 'yyyy-MM-dd'),
    };
  }, [calendarDate, calendarView]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ScheduleConfigResponse>('/provider/schedule-config', {
        params: {
          from: scheduleQueryRange.from,
          to: scheduleQueryRange.to,
        },
      })
      .then(res => {
        if (cancelled) return;
        const data = res.data;
        setProviderSchedule({
          weekly: data.weekly || {},
          allowedHours:
            Array.isArray(data.allowed_hours) && data.allowed_hours.length > 0
              ? data.allowed_hours
              : DEFAULT_PROVIDER_ALLOWED_HOURS,
          serverOverrides: overridesArrayToMap(data.overrides || []),
        });
      })
      .catch(() => {
        if (!cancelled) setProviderSchedule(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scheduleQueryRange, scheduleRefresh]);

  useEffect(() => {
    let cancelled = false;
    const days = daysToFetchForView(calendarView, calendarDate);

    Promise.all(
      days.map(d =>
        api.get<ApiAppointment[]>('/schedule', {
          params: { date: format(d, 'yyyy-MM-dd') },
        }),
      ),
    )
      .then(results => {
        if (cancelled) return;
        const merged: DashboardRow[] = [];
        const seen = new Set<string>();
        for (const res of results) {
          const list = Array.isArray(res.data) ? res.data : [];
          for (const a of list) {
            const id = String(a.id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(mapApiToRow(a));
            }
          }
        }
        merged.sort(
          (a, b) => +parseISO(String(a.date)) - +parseISO(String(b.date)),
        );
        setRangeAppointments(merged);
      })
      .catch(() => {
        if (!cancelled) setRangeAppointments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [calendarDate, calendarView, scheduleRefresh]);

  const closeBookModal = useCallback(() => {
    setBookModalOpen(false);
    setBookModalSlotStart(null);
  }, []);

  const closeRescheduleModal = useCallback(() => {
    setRescheduleModalOpen(false);
    setRescheduleRow(null);
  }, []);

  const handleBookingCreatedFromCalendar = useCallback(() => {
    closeBookModal();
    setScheduleRefresh(n => n + 1);
  }, [closeBookModal]);

  const handleRescheduleFlowCompleteFromCalendar = useCallback(() => {
    closeRescheduleModal();
    setScheduleRefresh(n => n + 1);
  }, [closeRescheduleModal]);

  const appointments = useMemo(
    () =>
      rangeAppointments.filter(a =>
        isSameDay(parseISO(String(a.date)), selectedDate),
      ),
    [rangeAppointments, selectedDate],
  );

  const calendarEvents = useMemo(
    () => rangeAppointments.map(rowToCalendarEvent),
    [rangeAppointments],
  );

  const eventPropGetter: CalendarProps<ProviderCalendarEvent>['eventPropGetter'] = useCallback(
    event => ({
      className: `event-variant-${event.variant ?? 'primary'}`,
    }),
    [],
  );

  const slotPropGetter = useCallback(
    (date: Date) => {
      if (!providerSchedule) return {};
      const ymd = format(date, 'yyyy-MM-dd');
      const eff = effectiveHoursServerOnly(
        providerSchedule.weekly,
        providerSchedule.allowedHours,
        ymd,
        providerSchedule.serverOverrides,
      );
      if (eff.size === 0) return {};
      const ok = isSlotAllowedForProvider(
        date,
        providerSchedule.weekly,
        providerSchedule.allowedHours,
        providerSchedule.serverOverrides,
      );
      return {
        className: ok ? undefined : 'rbc-slot-provider-blocked',
      };
    },
    [providerSchedule],
  );

  const dayPropGetter = useCallback(
    (date: Date) => {
      if (!providerSchedule) return {};
      const ymd = format(date, 'yyyy-MM-dd');
      const eff = effectiveHoursServerOnly(
        providerSchedule.weekly,
        providerSchedule.allowedHours,
        ymd,
        providerSchedule.serverOverrides,
      );
      if (eff.size > 0) return {};
      return { className: 'rbc-day-provider-closed' };
    },
    [providerSchedule],
  );

  const handleNavigate = useCallback((newDate: Date) => {
    setCalendarDate(newDate);
    setSelectedDate(newDate);
  }, []);

  const handleSelectEvent = useCallback(
    (event: ProviderCalendarEvent) => {
      const row = event.resource;
      setSelectedDate(new Date(event.start));
      setCalendarDate(new Date(event.start));
      if (row.status && row.status !== 'scheduled') {
        addToast({
          type: 'info',
          title: 'Marcação não pode ser alterada',
          description:
            'Só marcações com estado «Marcado» podem ser remarcadas ou canceladas a partir do calendário.',
        });
        return;
      }
      setRescheduleRow(row);
      setRescheduleModalOpen(true);
    },
    [addToast],
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      const d = new Date(slotInfo.start);
      if (Number.isNaN(d.getTime())) return;
      if (providerSchedule) {
        const allowed = isSlotAllowedForProvider(
          d,
          providerSchedule.weekly,
          providerSchedule.allowedHours,
          providerSchedule.serverOverrides,
        );
        if (!allowed) {
          addToast({
            type: 'info',
            title: 'Fora do horário disponível',
            description:
              'Este dia ou hora não faz parte da tua disponibilidade. Configura em Horários ou escolhe outro momento.',
          });
          return;
        }
      }
      setSelectedDate(d);
      setCalendarDate(d);
      setBookModalSlotStart(d);
      setBookModalOpen(true);
    },
    [addToast, providerSchedule],
  );

  const bookModalKey = bookModalSlotStart
    ? `book-${bookModalSlotStart.getTime()}`
    : 'book-closed';

  const rescheduleModalKey = rescheduleRow
    ? `reschedule-${String(rescheduleRow.id)}`
    : 'reschedule-closed';

  const selectedDateAsText = useMemo(() => {
    return format(selectedDate, "d 'de' MMMM yyyy", { locale: pt });
  }, [selectedDate]);

  const selectedWeekDayAsText = useMemo(() => {
    return format(selectedDate, 'cccc', { locale: pt });
  }, [selectedDate]);

  const morningAppointments = useMemo(() => {
    return appointments.filter(row => {
      return parseISO(String(row.date)).getHours() < 12;
    });
  }, [appointments]);

  const afternoonAppointments = useMemo(() => {
    return appointments.filter(row => {
      return parseISO(String(row.date)).getHours() >= 12;
    });
  }, [appointments]);

  const nextAppointment = useMemo(() => {
    return appointments.find(row =>
      isAfter(parseISO(String(row.date)), new Date()),
    );
  }, [appointments]);

  const minTime = useMemo(
    () => new Date(1970, 0, 1, 7, 0, 0),
    [],
  );
  const maxTime = useMemo(
    () => new Date(1970, 0, 1, 21, 0, 0),
    [],
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />
      <div className="mx-auto mt-16 max-w-[1120px] flex flex-col px-6 pb-20">
        <div className="beautyon-provider-calendar overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
          <ShadcnBigCalendar<ProviderCalendarEvent>
            localizer={localizer}
            culture="pt"
            style={{ height: 560, width: '100%' }}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            view={calendarView}
            date={calendarDate}
            components={{
              toolbar: ProviderCalendarToolbar as React.ComponentType<
                ToolbarProps<ProviderCalendarEvent>
              >,
            }}
            onNavigate={handleNavigate}
            onView={setCalendarView}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventPropGetter}
            slotPropGetter={slotPropGetter}
            dayPropGetter={dayPropGetter}
            messages={calendarMessages}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            min={minTime}
            max={maxTime}
            scrollToTime={minTime}
          />
        </div>

        <div className="mt-12 min-w-0 flex-1">
          <h1 className="text-[35px]">Agenda</h1>
          <p className="mt-2 flex flex-wrap items-center font-medium text-[var(--color-primary)]">
            {isToday(selectedDate) && <span className="mr-1">Hoje · </span>}
            <span className='capitalize'>{selectedWeekDayAsText}</span>
            <span className="flex items-center before:mx-2 before:h-3 before:w-px before:bg-[var(--color-primary)] before:content-['']">
              {selectedDateAsText}
            </span>
          </p>

          {isToday(selectedDate) && nextAppointment && (
            <div className="mt-16">
              <strong className="text-xl font-normal text-[var(--color-light-gray)]">
                Próxima marcação
              </strong>
              <Card className="relative mt-6 border-0 bg-[var(--color-shape)] shadow-none before:absolute before:left-0 before:top-[10%] before:z-0 before:h-[80%] before:w-px before:bg-[var(--color-primary)] before:content-['']">
                <CardContent className="relative z-[1] flex items-center gap-6 p-6">
                  <Avatar
                    name={nextAppointment.clientName}
                    src={nextAppointment.clientAvatar}
                    alt={nextAppointment.clientName}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                  <strong className="text-[var(--color-text-white)]">
                    {nextAppointment.clientName}
                  </strong>
                  <span className="ml-auto flex items-center text-[var(--color-light-gray)]">
                    <FiClock className="mr-2 text-[var(--color-primary)]" />
                    {nextAppointment.hourFormatted}
                  </span>
                </CardContent>
              </Card>
            </div>
          )}

          <section className="mt-12">
            <strong className="block text-xl leading-tight text-[var(--color-light-gray)]">
              Manhã
            </strong>
            <Separator className="my-4 bg-[var(--color-shape)]" />
            {morningAppointments.length === 0 && (
              <p className="text-[var(--color-light-gray)]">
                Sem marcações de manhã.
              </p>
            )}
            {morningAppointments.map(row => (
              <AppointmentRowBlock
                key={String(row.id)}
                row={row}
                statusUpdatingId={statusUpdatingId}
                updateAppointmentStatus={updateAppointmentStatus}
                goToReschedule={goToReschedule}
              />
            ))}
          </section>

          <section className="mt-12">
            <strong className="block text-xl leading-tight text-[var(--color-light-gray)]">
              Tarde
            </strong>
            <Separator className="my-4 bg-[var(--color-shape)]" />

            {afternoonAppointments.length === 0 && (
              <p className="text-[var(--color-light-gray)]">
                Sem marcações à tarde.
              </p>
            )}

            {afternoonAppointments.map(row => (
              <AppointmentRowBlock
                key={String(row.id)}
                row={row}
                statusUpdatingId={statusUpdatingId}
                updateAppointmentStatus={updateAppointmentStatus}
                goToReschedule={goToReschedule}
              />
            ))}
          </section>
        </div>
      </div>

      {bookModalOpen && user?.id && bookModalSlotStart && (
        <Modal
          open
          hideChrome
          onClose={closeBookModal}
          panelClassName="w-full max-w-2xl sm:max-w-4xl"
        >
          <BookingWizard
            key={bookModalKey}
            providerId={Number(user.id)}
            guestMode
            providerForClient
            presentation="modal"
            onRequestClose={closeBookModal}
            hideProviderSwitcher
            initialBookingDate={format(bookModalSlotStart, 'yyyy-MM-dd')}
            prefillSlotStart={bookModalSlotStart}
            onBookingCreated={handleBookingCreatedFromCalendar}
          />
        </Modal>
      )}

      {rescheduleModalOpen && user?.id && rescheduleRow && (
        <Modal
          open
          hideChrome
          onClose={closeRescheduleModal}
          panelClassName="w-full max-w-2xl sm:max-w-4xl"
        >
          <BookingWizard
            key={rescheduleModalKey}
            providerId={Number(user.id)}
            guestMode={false}
            presentation="modal"
            onRequestClose={closeRescheduleModal}
            hideProviderSwitcher
            reschedule={{
              appointmentId: Number(rescheduleRow.id),
              scope: 'provider',
              serviceId: rescheduleRow.serviceId ?? undefined,
              serviceName: rescheduleRow.serviceName ?? undefined,
              allowCancel: true,
            }}
            onRescheduleFlowComplete={handleRescheduleFlowCompleteFromCalendar}
            initialBookingDate={format(
              parseISO(String(rescheduleRow.date)),
              'yyyy-MM-dd',
            )}
            prefillSlotStart={parseISO(String(rescheduleRow.date))}
          />
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
