import React, { useCallback, useEffect, useState } from 'react';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import Input from '../../components/Input';
import Button from '../../components/Button';
import getValidationErrors from '../../utils/getValidationErrors';
import ProviderHeader from '../../components/ProviderHeader';
import { Badge } from '../../components/ui/badge';
import { Button as UIButton } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

interface ProviderServiceRow {
  id: number;
  name: string;
  duration_minutes: number;
  is_evaluation?: boolean;
  requires_prior_evaluation?: boolean;
}

interface FormData {
  name: string;
  duration_minutes: string;
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
          requires_prior_evaluation: Yup.boolean(),
        });

        const durationNum = Number(data.duration_minutes);

        await schema.validate(
          {
            name: data.name,
            duration_minutes: durationNum,
            requires_prior_evaluation: data.requires_prior_evaluation === true,
          },
          { abortEarly: false },
        );

        const payload = {
          name: data.name.trim(),
          duration_minutes: durationNum,
          requires_prior_evaluation: data.requires_prior_evaluation === true,
        };

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
        addToast({
          type: 'error',
          title: 'Não foi possível guardar',
          description: 'Verifique os dados e tente novamente.',
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
          Estes são os serviços que os clientes podem escolher ao marcar consigo.
          Duração em minutos (entre 5 e 480).
        </p>

        <Card className="mb-6 border-0 bg-[var(--color-black-medium)] text-[var(--color-text-white)] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[var(--color-white)]">
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
                requires_prior_evaluation:
                  editing?.requires_prior_evaluation ?? false,
              }}
            >
              <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_140px] sm:items-stretch">
                <Input name="name" placeholder="Nome do serviço (ex.: Corte)" />
                <Input
                  name="duration_minutes"
                  placeholder="Duração (min)"
                  type="number"
                  min={5}
                  max={480}
                />
              </div>
              <div className="my-2 mb-4 grid gap-3">
                <label className="flex select-none items-center gap-2.5 text-sm text-[var(--color-light-gray)] [&_input]:h-[18px] [&_input]:w-[18px] [&_input]:accent-[var(--color-primary)]">
                  <input type="checkbox" name="requires_prior_evaluation" />
                  Exige avaliação prévia para poder ser marcado
                </label>
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
                    className="mt-4 w-auto border-[var(--color-hard-gray)] bg-transparent text-[var(--color-white)] hover:bg-white/10"
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
            <CardTitle className="text-xl font-semibold text-[var(--color-white)]">
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
                            Requer avaliação
                          </Badge>
                        )}
                      </strong>
                      <span className="text-sm text-[var(--color-light-gray)]">
                        {s.duration_minutes} minutos
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {pendingDeleteId === s.id ? (
                        <>
                          <span className="text-[13px] text-[var(--color-light-gray)]">
                            Eliminar?
                          </span>
                          <UIButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[var(--color-error)] hover:bg-white/10"
                            onClick={() => handleDelete(s.id)}
                          >
                            Sim
                          </UIButton>
                          <UIButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[var(--color-primary)] hover:bg-white/10"
                            onClick={() => setPendingDeleteId(null)}
                          >
                            Não
                          </UIButton>
                        </>
                      ) : (
                        <>
                          <UIButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[var(--color-primary)] hover:bg-white/10"
                            onClick={() => startEdit(s)}
                          >
                            Editar
                          </UIButton>
                          <UIButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[var(--color-error)] hover:bg-white/10"
                            onClick={() => setPendingDeleteId(s.id)}
                          >
                            Eliminar
                          </UIButton>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProviderServices;
