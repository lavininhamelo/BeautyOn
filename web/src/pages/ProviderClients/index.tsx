import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import * as Yup from 'yup';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import Button from '../../components/Button';
import ProviderHeader from '../../components/ProviderHeader';
import TextField from '../../components/TextField';
import { Modal } from '../../components/ui/modal';
import { cn } from '../../lib/utils';

interface ProviderClientRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  has_clearance?: boolean;
}

const ProviderClients: React.FC = () => {
  const { addToast } = useToast();
  const history = useHistory();

  const [rows, setRows] = useState<ProviderClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [query, setQuery] = useState('');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const load = useCallback(() => {
    return api
      .get<ProviderClientRow[]>('/provider/clients')
      .then(res => setRows(res.data))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const editing = useMemo(
    () => rows.find(r => r.id === editingId),
    [rows, editingId],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.name || '').toLowerCase().includes(q));
  }, [rows, query]);

  const startEdit = useCallback((r: ProviderClientRow) => {
    setEditingId(r.id);
    setDraftName(r.name);
    setDraftPhone(r.phone ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftName('');
    setDraftPhone('');
  }, []);

  const save = useCallback(async () => {
    if (!editingId) return;
    try {
      await Yup.object({
        name: Yup.string().required().max(200),
        phone: Yup.string().min(8).max(32).required(),
      }).validate(
        { name: draftName.trim(), phone: draftPhone },
        { abortEarly: false },
      );

      await api.put(`/provider/clients/${editingId}`, {
        name: draftName.trim(),
        phone: draftPhone,
      });

      addToast({ type: 'success', title: 'Cliente atualizado' });
      cancelEdit();
      await load();
    } catch {
      addToast({
        type: 'error',
        title: 'Não foi possível atualizar',
        description: 'Verifique nome/telemóvel e tente novamente.',
      });
    }
  }, [addToast, cancelEdit, draftName, draftPhone, editingId, load]);

  const markAsEvaluated = useCallback(
    async (clientId: number) => {
      try {
        setMarkingId(clientId);
        await api.post(`/provider/clients/${clientId}/clearance`);
        setRows(prev =>
          prev.map(p => (p.id === clientId ? { ...p, has_clearance: true } : p)),
        );
        addToast({ type: 'success', title: 'Cliente marcada como avaliada' });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Não foi possível marcar',
          description: (err as any)?.response?.data?.error ?? 'Tente novamente.',
        });
      } finally {
        setMarkingId(current => (current === clientId ? null : current));
      }
    },
    [addToast],
  );

  const setClearance = useCallback(
    async (clientId: number, next: boolean) => {
      if (next) {
        await markAsEvaluated(clientId);
        return;
      }
      try {
        setMarkingId(clientId);
        await api.delete(`/provider/clients/${clientId}/clearance`);
        setRows(prev =>
          prev.map(p => (p.id === clientId ? { ...p, has_clearance: false } : p)),
        );
        addToast({ type: 'success', title: 'Avaliação removida' });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Não foi possível remover',
          description: (err as any)?.response?.data?.error ?? 'Tente novamente.',
        });
      } finally {
        setMarkingId(current => (current === clientId ? null : current));
      }
    },
    [addToast, markAsEvaluated],
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto mb-20 mt-12 max-w-[720px] px-6">
        <section className="mb-6 rounded-[14px] border border-white/[0.06] bg-[var(--color-black-medium)] p-6">
          <h1 className="mb-2 text-[28px]">Clientes</h1>
          <p className="mb-[18px] text-[var(--color-light-gray)]">
            Lista de clientes do salão associados à tua conta. Podes atualizar o nome e o telemóvel.
          </p>

          {loading && <p>A carregar…</p>}
          {!loading && rows.length === 0 && <p>Ainda não tens clientes.</p>}

          {!loading && rows.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              <li className="mb-3.5">
                <input
                  className="min-w-[240px] flex-1 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3.5 py-3 text-[var(--color-text-white)] placeholder:text-[var(--color-hard-gray)] focus:border-[var(--color-primary)] focus:outline-none"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Pesquisar por nome…"
                />
              </li>

              {filteredRows.map(r => (
                <li
                  key={r.id}
                  className="relative flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-[var(--color-shape)] p-4 pr-[130px] transition-[transform,border-color,background] duration-150 ease-out hover:-translate-y-px hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <label
                    className={cn(
                      'absolute right-3 top-3 z-[2] inline-flex select-none items-center gap-2.5',
                      markingId === r.id ? 'cursor-not-allowed' : 'cursor-pointer',
                    )}
                  >
                    <span className="text-xs font-extrabold text-[var(--color-light-gray)]">Avaliada</span>
                    <input
                      type="checkbox"
                      className="pointer-events-none absolute opacity-0"
                      checked={!!r.has_clearance}
                      disabled={markingId === r.id}
                      onChange={e => setClearance(r.id, e.target.checked)}
                    />
                    <div
                      className={cn(
                        'relative h-[26px] w-[44px] rounded-full border border-white/[0.12] p-0.5 transition-[background,opacity] duration-150 ease-out',
                        r.has_clearance ? 'bg-[rgba(228,160,188,0.35)]' : 'bg-white/[0.06]',
                        markingId === r.id && 'opacity-65',
                      )}
                    >
                      <span
                        className={cn(
                          'block h-5 w-5 rounded-full bg-[var(--color-white)] transition-transform duration-150 ease-out',
                          r.has_clearance ? 'translate-x-[18px]' : 'translate-x-0',
                        )}
                      />
                    </div>
                  </label>
                  <div className="min-w-[240px] flex-1">
                    <strong className="mb-1.5 block text-base tracking-wide">{r.name}</strong>
                    <span className="mb-0 block text-[13px] leading-snug text-[var(--color-light-gray)]">
                      {r.phone ?? 'Sem telemóvel'}
                    </span>
                    <span className="mb-0 block text-[13px] leading-snug text-[var(--color-light-gray)]">
                      {r.email}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-[10px] border border-white/[0.10] bg-white/[0.02] px-3 py-2 text-sm font-bold text-[var(--color-text-white)] hover:bg-white/[0.06] hover:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-65"
                      onClick={() => startEdit(r)}
                    >
                      Editar Cliente
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-[10px] border border-white/[0.10] bg-white/[0.02] px-3 py-2 text-sm font-bold text-[var(--color-text-white)] hover:bg-white/[0.06] hover:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-65"
                      onClick={() => history.push(`/provider/clients/${r.id}/history`)}
                    >
                      Atendimentos
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-[10px] border border-white/[0.10] bg-white/[0.02] px-3 py-2 text-sm font-bold text-[var(--color-text-white)] hover:bg-white/[0.06] hover:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-65"
                      onClick={() => history.push(`/provider/clients/${r.id}/timeline`)}
                    >
                      Histórico
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Modal
          open={editingId !== null}
          onClose={cancelEdit}
          title="Editar cliente"
          panelClassName="max-w-lg"
        >
          {editing && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Nome"
                  value={draftName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDraftName(e.target.value)
                  }
                  placeholder="Nome"
                />
                <TextField
                  label="Telemóvel"
                  value={draftPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDraftPhone(e.target.value)
                  }
                  placeholder="Telemóvel"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" onClick={save}>
                  Guardar
                </Button>
                <Button type="button" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </Modal>
      </main>
    </div>
  );
};

export default ProviderClients;
