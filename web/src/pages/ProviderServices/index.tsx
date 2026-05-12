import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import Input from '../../components/Input';
import FormCheckboxField from '../../components/FormCheckboxField';
import Button from '../../components/Button';
import getValidationErrors from '../../utils/getValidationErrors';
import {
  centsToEuroFormString,
  parseEuroInputToCents,
  formatPriceFromCents,
} from '../../utils/money';
import ProviderHeader from '../../components/ProviderHeader';
import { Badge } from '../../components/ui/badge';
import { Button as UIButton } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';

interface ProviderServiceRow {
  id: number;
  name: string;
  duration_minutes: number;
  price_cents?: number;
  is_evaluation?: boolean;
  requires_prior_evaluation?: boolean;
}

interface FormData {
  name: string;
  duration_minutes: string;
  price_euros?: string;
  is_evaluation?: boolean;
  requires_prior_evaluation?: boolean;
}

const ProviderServices: React.FC = () => {
  const { addToast } = useToast();
  const formRef = React.useRef<FormHandles>(null);

  const [services, setServices] = useState<ProviderServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const loadServices = useCallback(() => {
    return api
      .get<ProviderServiceRow[]>('/provider/services')
      .then(res => setServices(res.data))
      .catch(() => {
        setServices([]);
        addToast({
          type: 'error',
          title: 'Erro',
          description: 'Não foi possível carregar os serviços.',
        });
      });
  }, [addToast]);

  useEffect(() => {
    let cancelled = false;
    loadServices().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadServices]);

  const editing = editingId
    ? services.find(s => s.id === editingId)
    : undefined;

  const pendingDeleteService = useMemo(
    () =>
      pendingDeleteId != null
        ? services.find(s => s.id === pendingDeleteId)
        : undefined,
    [pendingDeleteId, services],
  );

  const handleSubmit = useCallback(
    async (data: FormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object({
          name: Yup.string().required('Nome obrigatório').trim().max(120),
          duration_minutes: Yup.number()
            .typeError('Indique a duração em minutos')
            .integer()
            .min(5, 'Mínimo 5 minutos')
            .max(480, 'Máximo 480 minutos'),
        });

        const durationNum = Number(data.duration_minutes);
        const priceRaw = String(data.price_euros ?? '').trim();
        const priceCents = parseEuroInputToCents(priceRaw);
        if (priceCents === null) {
          const fr = formRef.current;
          if (fr) fr.setFieldError('price_euros', 'Preço inválido (ex.: 25 ou 25,50)');
          return;
        }

        await schema.validate(
          {
            name: data.name,
            duration_minutes: durationNum,
          },
          { abortEarly: false },
        );

        const requiresPriorEvaluation = data.requires_prior_evaluation === true;

        const payload: Record<string, unknown> = {
          name: data.name.trim(),
          duration_minutes: durationNum,
          price_cents: priceCents,
          requires_prior_evaluation: requiresPriorEvaluation,
        };

        if (editingId != null) {
          const row = services.find(s => s.id === editingId);
          if (row) {
            payload.is_evaluation = row.is_evaluation === true;
          }
        }

        if (editingId) {
          await api.put(`/provider/services/${editingId}`, payload);
          addToast({
            type: 'success',
            title: 'Serviço atualizado',
          });
        } else {
          await api.post('/provider/services', payload);
          addToast({
            type: 'success',
            title: 'Serviço criado',
          });
        }

        setEditingId(null);
        const fr = formRef.current;
        if (fr) fr.reset();
        await loadServices();
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const fr = formRef.current;
          if (fr) fr.setErrors(getValidationErrors(err));
          return;
        }
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        addToast({
          type: 'error',
          title: 'Não foi possível guardar',
          description: msg ?? 'Verifica os dados e tenta novamente.',
        });
      }
    },
    [addToast, editingId, loadServices],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/provider/services/${id}`);
        addToast({ type: 'success', title: 'Serviço eliminado' });
        if (editingId === id) {
          setEditingId(null);
          const fr = formRef.current;
          if (fr) fr.reset();
        }
        await loadServices();
      } catch {
        addToast({
          type: 'error',
          title: 'Não foi possível eliminar',
        });
      } finally {
        setPendingDeleteId(null);
      }
    },
    [addToast, editingId, loadServices],
  );

  const startEdit = useCallback((s: ProviderServiceRow) => {
    setEditingId(s.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    const fr = formRef.current;
    if (fr) fr.reset();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto mb-20 mt-12 max-w-[720px] px-6">
        <h1 className="mb-2 text-[32px]">Os meus serviços</h1>
        <p className="mb-8 leading-normal text-[var(--color-light-gray)]">
          Configure os serviços que os clientes podem escolher ao marcar consigo.
        </p>

        <Card className="mb-6 border-0 bg-[var(--color-black-medium)] text-[var(--color-text-white)] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[var(--color-text-white)]">
              {editingId ? 'Editar serviço' : 'Novo serviço'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form
              key={editingId ?? 'new'}
              ref={formRef}
              onSubmit={handleSubmit}
              initialData={{
                name: editing?.name ?? '',
                duration_minutes: editing
                  ? String(editing.duration_minutes)
                  : '',
                price_euros: editing
                  ? centsToEuroFormString(editing.price_cents ?? 0)
                  : '',
                requires_prior_evaluation:
                  editing?.requires_prior_evaluation ?? false,
              }}
            >
              <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[3fr_2.5fr_1fr] sm:items-stretch">
                <Input name="name" placeholder="Nome do Serviço" />
                <Input
                  name="duration_minutes"
                  placeholder="Duração (min)"
                  type="number"
                  min={5}
                  max={480}
                />
                <Input
                  name="price_euros"
                  placeholder="Preço (€)"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </div>
              <p className="mb-4 text-[13px] text-[var(--color-light-gray)]">
                Preço opcional — vazio = 0&nbsp;€. Usa vírgula ou ponto (ex.: 35 ou 35,50).
              </p>
              <div className="my-2 mb-4 grid gap-3">
                <FormCheckboxField
                  name="requires_prior_evaluation"
                  className="text-sm text-[var(--color-light-gray)]"
                >
                  Exige avaliação prévia para poder ser marcado
                </FormCheckboxField>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  {editingId ? 'Guardar alterações' : 'Adicionar serviço'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    className="mt-4 w-auto border-[var(--color-hard-gray)] bg-transparent text-[var(--color-text-white)] hover:bg-[var(--color-primary)]/10"
                  >
                    Cancelar edição
                  </Button>
                )}
              </div>
            </Form>
          </CardContent>
        </Card>

        <Card className="mb-6 border-0 bg-[var(--color-black-medium)] text-[var(--color-text-white)] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[var(--color-text-white)]">
              Lista de serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p>A carregar…</p>}
            {!loading && services.length === 0 && (
              <p>Ainda não criou serviços. Adicione o primeiro acima.</p>
            )}
            {!loading && services.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {services.map(s => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] bg-[var(--color-shape)] p-4"
                  >
                    <div className="min-w-[160px] flex-1">
                      <strong className="mb-1 block text-[17px]">
                        {s.name}
                        {s.requires_prior_evaluation && (
                          <Badge variant="secondary" className="ml-2.5 align-middle">
                            Restrito / Avaliada
                          </Badge>
                        )}
                      </strong>
                      <span className="text-sm text-[var(--color-light-gray)]">
                        {s.duration_minutes} minutos
                        {(s.price_cents ?? 0) > 0 && (
                          <>
                            {' · '}
                            {formatPriceFromCents(s.price_cents ?? 0)}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <UIButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                        onClick={() => startEdit(s)}
                      >
                        Editar
                      </UIButton>
                      <UIButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[var(--color-error)] hover:bg-[var(--color-primary)]/10"
                        onClick={() => setPendingDeleteId(s.id)}
                      >
                        Eliminar
                      </UIButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Modal
          open={pendingDeleteId !== null}
          onClose={() => setPendingDeleteId(null)}
          hideChrome
          panelClassName="max-w-md"
        >
          <div className="border-b border-[var(--color-input-border)] px-5 py-4">
            <h2
              id="modal-title"
              className="m-0 text-lg font-semibold text-[var(--color-text-white)]"
            >
              Eliminar serviço?
            </h2>
          </div>
          <div className="px-5 py-5">
            <p className="m-0 text-sm leading-relaxed text-[var(--color-text-white)]">
              Tens a certeza que queres eliminar{' '}
              <strong className="font-semibold text-[var(--color-primary)]">
                {pendingDeleteService?.name ?? 'este serviço'}
              </strong>
              ?
            </p>
         
            <div className="mt-4 flex flex-wrap justify-end gap-2.5">
              <UIButton
                type="button"
                variant="outline"
                onClick={() => setPendingDeleteId(null)}
              >
                Cancelar
              </UIButton>
              <UIButton
                type="button"
                variant="destructive"
                disabled={pendingDeleteId === null}
                onClick={() => {
                  if (pendingDeleteId != null) void handleDelete(pendingDeleteId);
                }}
              >
                Eliminar
              </UIButton>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

export default ProviderServices;
