import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Link, useHistory } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import { useAuth } from '../../hooks/auth';
import Input from '../Input';
import DatePickerField from '../DatePickerField';
import getValidationErrors from '../../utils/getValidationErrors';
import { cn } from '../../lib/utils';

import { ProviderApiItem } from '../ProviderPicker';

interface ServiceItem {
  id: number;
  name: string;
  duration_minutes: number;
  is_evaluation?: boolean;
  requires_prior_evaluation?: boolean;
}

interface SlotItem {
  time: string;
  value: string;
  available: boolean;
}

export interface RescheduleContext {
  appointmentId: number;
  scope: 'client' | 'provider';
  serviceId?: number;
  serviceName?: string;
  allowCancel?: boolean;
}

export interface BookingWizardProps {
  providerId: number;
  guestMode: boolean;
  reschedule?: RescheduleContext;
  providerForClient?: boolean;
  presentation?: 'page' | 'modal';
  onRequestClose?: () => void;
  hideProviderSwitcher?: boolean;
  initialBookingDate?: string;
  prefillSlotStart?: Date;
  onBookingCreated?: () => void;
  onRescheduleFlowComplete?: () => void;
}

function pickNearestAvailableSlot(
  slotList: SlotItem[],
  target: Date,
): SlotItem | null {
  const available = slotList.filter(s => s.available);
  if (available.length === 0) return null;
  const targetMin = target.getHours() * 60 + target.getMinutes();
  let best: SlotItem | null = null;
  let bestDist = Infinity;
  for (const s of available) {
    const parts = s.time.split(':').map(Number);
    const h = Number.isFinite(parts[0]) ? parts[0] : 0;
    const m = Number.isFinite(parts[1]) ? parts[1] : 0;
    const slotMin = h * 60 + m;
    const dist = Math.abs(slotMin - targetMin);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

function slotHourLabel(timeLabel: string): number {
  const [h] = timeLabel.split(':').map(Number);
  return Number.isFinite(h) ? h : 12;
}

function avatarFallback(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?backgroundColor=ffd2e4&&seed=${encodeURIComponent(
    name,
  )}`;
}

const BookingWizard: React.FC<BookingWizardProps> = ({
  providerId,
  guestMode,
  reschedule,
  providerForClient = false,
  presentation = 'page',
  onRequestClose,
  hideProviderSwitcher = false,
  initialBookingDate,
  prefillSlotStart,
  onBookingCreated,
  onRescheduleFlowComplete,
}) => {
  const isReschedule = !!reschedule;
  const isProviderForClient = !!providerForClient;
  const guestModeEffective = isProviderForClient ? true : guestMode;

  const { addToast } = useToast();
  const history = useHistory();
  const { user } = useAuth();
  const formRef = useRef<FormHandles>(null);

  const [providers, setProviders] = useState<ProviderApiItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [hasClearance, setHasClearance] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState(() =>
    initialBookingDate ?? format(new Date(), 'yyyy-MM-dd'),
  );
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const prefillAppliedRef = useRef(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const baseBookPath = guestModeEffective ? '/book' : '/client/book';

  useEffect(() => {
    if (isProviderForClient || isReschedule) return;
    let cancelled = false;
    api
      .get<ProviderApiItem[]>('/providers')
      .then(res => {
        if (!cancelled) setProviders(res.data);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isProviderForClient, isReschedule]);

  useEffect(() => {
    let cancelled = false;
    const req = isProviderForClient
      ? api.get<ServiceItem[]>('/provider/services')
      : api.get<ServiceItem[]>(`/providers/${providerId}/services`);

    req
      .then(res => {
        if (!cancelled) setServices(res.data);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, isProviderForClient]);

  useEffect(() => {
    if (guestModeEffective || isProviderForClient) {
      setHasClearance(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ has_clearance: boolean; reason?: string }>('/booking/eligibility', {
        params: { provider_id: providerId },
      })
      .then(res => {
        if (!cancelled) setHasClearance(!!res.data.has_clearance);
      })
      .catch(() => {
        if (!cancelled) setHasClearance(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guestModeEffective, providerId, isProviderForClient]);

  useEffect(() => {
    if (services.length === 0) {
      setServiceId(null);
      return;
    }
    setServiceId(prev => {
      if (reschedule?.serviceId && services.some(s => s.id === reschedule.serviceId)) {
        return reschedule.serviceId;
      }
      const exists = services.some(s => s.id === prev);
      return exists ? prev : services[0].id;
    });
  }, [services, reschedule]);

  const serviceById = useMemo(
    () => services.find(s => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  const requiresEvalBlocked = useCallback(
    (s: ServiceItem) => {
      if (isProviderForClient) return false;
      if (s.is_evaluation) return false;
      return !!s.requires_prior_evaluation && hasClearance !== true;
    },
    [hasClearance, isProviderForClient],
  );

  const fetchSlots = useCallback(() => {
    if (!serviceId) return;
    setLoadingSlots(true);
    api
      .get<SlotItem[]>(`/providers/${providerId}/available`, {
        params: {
          date: selectedDate,
          service_id: serviceId,
        },
      })
      .then(res => {
        setSlots(res.data);
        setSelectedSlot(null);
      })
      .catch(() => {
        setSlots([]);
        addToast({
          type: 'error',
          title: 'Erro',
          description: 'Não foi possível carregar horários.',
        });
      })
      .finally(() => setLoadingSlots(false));
  }, [providerId, selectedDate, serviceId, addToast]);

  useEffect(() => {
    if (serviceId) fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, selectedDate]);

  useEffect(() => {
    if (
      !prefillSlotStart ||
      Number.isNaN(prefillSlotStart.getTime()) ||
      slots.length === 0
    ) {
      return;
    }
    if (loadingSlots) return;
    if (prefillAppliedRef.current) return;
    const dayStr = format(prefillSlotStart, 'yyyy-MM-dd');
    if (dayStr !== selectedDate) return;
    const chosen = pickNearestAvailableSlot(slots, prefillSlotStart);
    if (chosen) setSelectedSlot(chosen);
    prefillAppliedRef.current = true;
  }, [slots, loadingSlots, prefillSlotStart, selectedDate]);

  const morningSlots = useMemo(
    () => slots.filter(s => slotHourLabel(s.time) < 12),
    [slots],
  );

  const afternoonSlots = useMemo(
    () => slots.filter(s => slotHourLabel(s.time) >= 12),
    [slots],
  );

  const selectProvider = useCallback(
    (id: number) => {
      if (isReschedule || isProviderForClient) return;
      history.replace(`${baseBookPath}/${id}`);
    },
    [history, baseBookPath, isReschedule, isProviderForClient],
  );

  const selectedDateDisplay = useMemo(() => {
    try {
      return format(parseISO(`${selectedDate}T12:00:00`), "d 'de' MMMM yyyy", {
        locale: pt,
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handleGuestSubmit = useCallback(
    async (data: { guest_name: string; guest_phone: string }) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        await Yup.object({
          guest_name: Yup.string().required('Nome obrigatório'),
          guest_phone: Yup.string().min(8).max(32).required('Telemóvel obrigatório'),
        }).validate(data, { abortEarly: false });

        if (!selectedSlot || !serviceId) {
          addToast({
            type: 'info',
            title: 'Escolha data e horário',
            description: 'Selecione um horário disponível antes de agendar.',
          });
          return;
        }

        await api.post('/appointments/guest', {
          provider_id: providerId,
          provider_service_id: serviceId,
          date: selectedSlot.value,
          guest_name: data.guest_name,
          guest_phone: data.guest_phone,
        });

        addToast({
          type: 'success',
          title: 'Marcação criada',
          description: 'O profissional foi notificado.',
        });
        history.push('/book');
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const r = formRef.current;
          if (r) r.setErrors(getValidationErrors(err));
          return;
        }
        const msg = (err as any)?.response?.data?.error ?? 'Tente novamente.';
        addToast({
          type: 'error',
          title: 'Erro ao marcar',
          description: msg,
        });
      }
    },
    [addToast, history, providerId, selectedSlot, serviceId],
  );

  const handleProviderForClientSubmit = useCallback(
    async (data: { client_name: string; client_phone: string }) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        await Yup.object({
          client_name: Yup.string().required('Nome obrigatório'),
          client_phone: Yup.string().min(8).max(32).required('Telemóvel obrigatório'),
        }).validate(data, { abortEarly: false });

        if (!selectedSlot || !serviceId) {
          addToast({
            type: 'info',
            title: 'Escolha data e horário',
            description: 'Selecione um horário disponível antes de criar a marcação.',
          });
          return;
        }

        await api.post('/provider/appointments/for-client', {
          provider_service_id: serviceId,
          date: selectedSlot.value,
          client_name: data.client_name,
          client_phone: data.client_phone,
        });

        try {
          await api.post('/provider/clients', {
            name: data.client_name,
            phone: data.client_phone,
          });
        } catch {
        }

        addToast({ type: 'success', title: 'Marcação criada' });
        if (onBookingCreated) {
          onBookingCreated();
        } else {
          history.push('/provider');
        }
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const r = formRef.current;
          if (r) r.setErrors(getValidationErrors(err));
          return;
        }
        addToast({
          type: 'error',
          title: 'Erro ao marcar',
          description:
            (err as any)?.response?.data?.error ??
            'Verifique os dados e tente novamente.',
        });
      }
    },
    [addToast, history, onBookingCreated, selectedSlot, serviceId],
  );

  const handleAuthSubmit = useCallback(async () => {
    if (!serviceId || !selectedSlot) {
      addToast({
        type: 'info',
        title: 'Escolha data e horário',
        description: 'Selecione um horário disponível antes de agendar.',
      });
      return;
    }
    try {
      await api.post('/appointments', {
        provider_id: providerId,
        provider_service_id: serviceId,
        date: selectedSlot.value,
      });
      addToast({
        type: 'success',
        title: 'Marcação criada',
      });
      history.push('/client/appointments');
    } catch {
      addToast({
        type: 'error',
        title: 'Erro ao marcar',
        description:
          'Verifique se já tem avaliação (quando necessário) e tente outro horário.',
      });
    }
  }, [addToast, history, providerId, selectedSlot, serviceId]);

  const handleRescheduleSubmit = useCallback(async () => {
    if (!reschedule || !selectedSlot) {
      addToast({
        type: 'info',
        title: 'Escolha um novo horário',
        description: 'Selecione uma data e hora antes de remarcar.',
      });
      return;
    }
    const url =
      reschedule.scope === 'provider'
        ? `/provider/appointments/${reschedule.appointmentId}/reschedule`
        : `/appointments/${reschedule.appointmentId}/reschedule`;

    try {
      await api.patch(url, { date: selectedSlot.value });
      addToast({
        type: 'success',
        title: 'Marcação remarcada',
      });
      if (onRescheduleFlowComplete) {
        onRescheduleFlowComplete();
      } else {
        history.push(
          reschedule.scope === 'provider' ? '/provider' : '/client/appointments',
        );
      }
    } catch (err) {
      const description = (err as any)?.response?.data?.error ?? 'Tente outro horário.';
      addToast({
        type: 'error',
        title: 'Não foi possível remarcar',
        description,
      });
    }
  }, [addToast, history, onRescheduleFlowComplete, reschedule, selectedSlot]);

  const handleCancelAppointment = useCallback(async () => {
    if (!reschedule) return;
    if (
      !window.confirm(
        'Tem a certeza que deseja cancelar esta marcação? Esta ação não pode ser desfeita.',
      )
    ) {
      return;
    }
    setCancelSubmitting(true);
    try {
      if (reschedule.scope === 'provider') {
        await api.patch(`/provider/appointments/${reschedule.appointmentId}/status`, {
          status: 'canceled',
        });
      } else {
        await api.delete(`/appointments/${reschedule.appointmentId}`);
      }
      addToast({ type: 'success', title: 'Marcação cancelada' });
      if (onRescheduleFlowComplete) {
        onRescheduleFlowComplete();
      } else {
        history.push(
          reschedule.scope === 'provider' ? '/provider' : '/client/appointments',
        );
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Não foi possível cancelar',
        description:
          (err as any)?.response?.data?.error ??
          'Tenta novamente dentro de momentos.',
      });
    } finally {
      setCancelSubmitting(false);
    }
  }, [addToast, history, onRescheduleFlowComplete, reschedule]);

  const isModal = presentation === 'modal';

  const backLink = isReschedule
    ? reschedule!.scope === 'provider'
      ? '/provider'
      : '/client/appointments'
    : isProviderForClient
      ? '/provider'
      : guestModeEffective
        ? '/book'
        : '/client';

  const headerTitle = isReschedule
    ? 'Remarcar'
    : isProviderForClient
      ? 'Marcar para cliente'
      : 'Profissionais';

  const profileAvatar =
    user?.avatar_url ||
    (user
      ? `https://api.dicebear.com/7.x/initials/svg?backgroundColor=ffd2e4&&seed=${encodeURIComponent(
          user.name,
        )}`
      : undefined);

  const agendarDisabled =
    !serviceId || !selectedSlot || loadingSlots || services.length === 0;

  return (
    <div
      className={
        isModal
          ? 'flex min-h-0 flex-col bg-[var(--color-background)]'
          : 'min-h-screen bg-[var(--color-background)]'
      }
    >
      <header className="flex shrink-0 items-center gap-4 bg-[var(--color-black-medium)] px-6 py-6">
        {isModal && onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            className="flex items-center text-2xl leading-none text-[var(--color-light-gray)] hover:text-[var(--color-primary)]"
          >
            ‹
          </button>
        ) : (
          <Link
            to={backLink}
            className="flex items-center text-2xl leading-none text-[var(--color-light-gray)] hover:text-[var(--color-primary)]"
          >
            ‹
          </Link>
        )}
        <span className="flex-1 text-xl font-medium text-[var(--color-white)]">
          {headerTitle}
        </span>
        {!!profileAvatar && (
          <img
            src={profileAvatar}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        )}
      </header>

      <div className="pb-12">
        {!isReschedule && !isProviderForClient && !hideProviderSwitcher && (
          <div className="-webkit-overflow-scrolling-touch flex gap-4 overflow-x-auto px-6 pb-6 pt-4 scrollbar-thin">
            {providers.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-[10px] border-0 px-4 py-2 text-base hover:brightness-105',
                  p.id === providerId
                    ? 'bg-[var(--color-primary)] text-[var(--color-inputs)]'
                    : 'bg-[var(--color-shape)] text-[var(--color-white)]',
                )}
                onClick={() => selectProvider(p.id)}
              >
                <img
                  src={p.avatar?.url ?? avatarFallback(p.name)}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <h2 className="mx-6 mb-6 mt-0 text-2xl font-medium text-[var(--color-white)]">
          Serviço
        </h2>
        <div className="-webkit-overflow-scrolling-touch flex gap-4 overflow-x-auto px-6 pb-6 scrollbar-thin">
          {services.map(s => {
            const blocked =
              isReschedule ||
              requiresEvalBlocked(s);
            return (
              <button
                key={s.id}
                type="button"
                disabled={blocked}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-[10px] border-0 px-4 py-2 text-base hover:brightness-105',
                  serviceId === s.id
                    ? 'bg-[var(--color-primary)] text-[var(--color-inputs)]'
                    : 'bg-[var(--color-shape)] text-[var(--color-white)]',
                  blocked && 'cursor-not-allowed opacity-50',
                )}
                onClick={() => {
                  if (isReschedule) return;
                  if (requiresEvalBlocked(s)) {
                    addToast({
                      type: 'info',
                      title: 'Requer avaliação',
                      description:
                        'Este serviço só pode ser marcado após uma avaliação. Apenas o profissional pode marcar, a menos que o cliente esteja como “Avaliado”.',
                    });
                    return;
                  }
                  setServiceId(s.id);
                }}
              >
                {s.name} · {s.duration_minutes} min
              </button>
            );
          })}
        </div>

        {!serviceById?.is_evaluation && serviceById?.requires_prior_evaluation && (
          <p className="mx-6 mb-4 text-sm text-[var(--color-light-gray)]">
            Este serviço requer avaliação prévia. Apenas o profissional pode marcar, a menos
            que o cliente esteja como “Avaliado”.
          </p>
        )}
        {services.length === 0 && (
          <p className="mx-6 mb-4 text-sm text-[var(--color-light-gray)]">
            Este profissional ainda não tem serviços.
          </p>
        )}

        <h2 className="mx-6 mb-6 text-2xl font-medium text-[var(--color-white)]">
          Escolha a data
        </h2>
        <DatePickerField
          value={selectedDate}
          onChange={setSelectedDate}
          displayValue={selectedDateDisplay}
        />

        <div className="pt-2">
          <h2 className="mx-6 mb-6 text-2xl font-medium text-[var(--color-white)]">
            Escolha o horário
          </h2>

          {loadingSlots && (
            <p className="mx-6 mb-4 text-sm text-[var(--color-light-gray)]">
              A carregar horários…
            </p>
          )}

          {!loadingSlots &&
            serviceId &&
            slots.filter(s => s.available).length === 0 && (
              <p className="mx-6 mb-4 text-sm text-[var(--color-light-gray)]">
                Sem horários disponíveis neste dia. Escolha outra data.
              </p>
            )}

          <p className="mx-6 mb-3 text-lg text-[var(--color-light-gray)]">Manhã</p>
          <div className="-webkit-overflow-scrolling-touch flex gap-2 overflow-x-auto px-6 pb-4">
            {morningSlots.map(s => (
              <button
                key={s.value}
                type="button"
                disabled={!s.available}
                className={cn(
                  'shrink-0 rounded-[10px] border-0 px-3 py-3 text-base',
                  s.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-35',
                  selectedSlot?.value === s.value
                    ? 'bg-[var(--color-primary)] text-[var(--color-inputs)]'
                    : 'bg-[var(--color-shape)] text-[var(--color-white)]',
                )}
                onClick={() => s.available && setSelectedSlot(s)}
              >
                {format(parseISO(s.value), 'HH:mm')}
              </button>
            ))}
          </div>

          <p className="mx-6 mb-3 text-lg text-[var(--color-light-gray)]">Tarde</p>
          <div className="-webkit-overflow-scrolling-touch flex gap-2 overflow-x-auto px-6 pb-4">
            {afternoonSlots.map(s => (
              <button
                key={s.value}
                type="button"
                disabled={!s.available}
                className={cn(
                  'shrink-0 rounded-[10px] border-0 px-3 py-3 text-base',
                  s.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-35',
                  selectedSlot?.value === s.value
                    ? 'bg-[var(--color-primary)] text-[var(--color-inputs)]'
                    : 'bg-[var(--color-shape)] text-[var(--color-white)]',
                )}
                onClick={() => s.available && setSelectedSlot(s)}
              >
                {format(parseISO(s.value), 'HH:mm')}
              </button>
            ))}
          </div>
        </div>

        {isReschedule ? (
          <div className="mx-6 mb-6 mt-2 flex max-w-[640px] flex-col gap-3">
            <button
              type="button"
              disabled={agendarDisabled}
              onClick={handleRescheduleSubmit}
              className={cn(
                'block h-[50px] w-full rounded-[10px] border-0 text-lg font-medium',
                'bg-[var(--color-primary)] text-[var(--color-inputs)] hover:brightness-105',
                agendarDisabled && 'cursor-not-allowed opacity-50',
              )}
            >
              Remarcar
            </button>
            {(reschedule?.allowCancel !== false) && (
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={handleCancelAppointment}
                className={cn(
                  'block h-[50px] w-full rounded-[10px] border border-[var(--color-error)] bg-transparent text-lg font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10',
                  cancelSubmitting && 'cursor-not-allowed opacity-60',
                )}
              >
                {cancelSubmitting ? 'A cancelar…' : 'Cancelar marcação'}
              </button>
            )}
          </div>
        ) : isProviderForClient ? (
          <Form ref={formRef} onSubmit={handleProviderForClientSubmit}>
            <h2 className="mx-6 mb-6 text-2xl font-medium text-[var(--color-white)]">
              Dados da cliente
            </h2>
            <div className="flex max-w-[400px] flex-wrap items-center gap-3 px-6 pb-6 pt-2">
              <Input name="client_name" placeholder="Nome completo" />
              <Input name="client_phone" placeholder="Telemóvel" />
            </div>
            <button
              type="submit"
              disabled={agendarDisabled}
              className={cn(
                'mx-6 mb-6 mt-2 block h-[50px] w-[calc(100%-48px)] max-w-[640px] rounded-[10px] border-0 text-lg font-medium',
                'bg-[var(--color-primary)] text-[var(--color-inputs)] hover:brightness-105',
                agendarDisabled && 'cursor-not-allowed opacity-50',
              )}
            >
              Criar marcação
            </button>
          </Form>
        ) : guestModeEffective ? (
          <Form ref={formRef} onSubmit={handleGuestSubmit}>
            <h2 className="mx-6 mb-6 text-2xl font-medium text-[var(--color-white)]">
              Os seus dados
            </h2>
            <div className="flex max-w-[400px] flex-wrap items-center gap-3 px-6 pb-6 pt-2">
              <Input name="guest_name" placeholder="Nome completo" />
              <Input name="guest_phone" placeholder="Telemóvel" />
            </div>
            <button
              type="submit"
              disabled={agendarDisabled}
              className={cn(
                'mx-6 mb-6 mt-2 block h-[50px] w-[calc(100%-48px)] max-w-[640px] rounded-[10px] border-0 text-lg font-medium',
                'bg-[var(--color-primary)] text-[var(--color-inputs)] hover:brightness-105',
                agendarDisabled && 'cursor-not-allowed opacity-50',
              )}
            >
              Agendar
            </button>
          </Form>
        ) : (
          <button
            type="button"
            disabled={agendarDisabled}
            onClick={handleAuthSubmit}
            className={cn(
              'mx-6 mb-6 mt-2 block h-[50px] w-[calc(100%-48px)] max-w-[640px] rounded-[10px] border-0 text-lg font-medium',
              'bg-[var(--color-primary)] text-[var(--color-inputs)] hover:brightness-105',
              agendarDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            Agendar
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingWizard;

