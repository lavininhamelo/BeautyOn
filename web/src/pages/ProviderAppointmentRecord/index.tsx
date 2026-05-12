import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import Button from '../../components/Button';
import ProviderHeader from '../../components/ProviderHeader';
import TextField from '../../components/TextField';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { AppointmentRecordFileUploadPreview } from '../../components/file-upload/AppointmentRecordFileUploadPreview';

type RecordPhoto = {
  id: number;
  file: { id: number; name: string; url?: string };
};

type RecordResponse = {
  id: number;
  appointment_id: number;
  notes: string;
  summary?: string | null;
  recorded_at: string;
  photos: RecordPhoto[];
};

const ProviderAppointmentRecord: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const apptId = Number(appointmentId);
  const { addToast } = useToast();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!Number.isFinite(apptId)) return;
    let cancelled = false;

    setLoading(true);
    setNotes('');
    setSummary('');
    setPhotos([]);
    setNewFiles([]);

    api
      .get<RecordResponse>(`/provider/appointments/${apptId}/record`)
      .then(res => {
        if (cancelled) return;
        setNotes(res.data.notes ?? '');
        setSummary(res.data.summary ?? '');
        setPhotos(res.data.photos ?? []);
      })
      .catch(err => {
        if (cancelled) return;
        if (err?.response?.status === 204) {
          setNotes('');
          setSummary('');
          setPhotos([]);
          return;
        }
        if (err?.response?.status !== 204) {
          addToast({ type: 'error', title: 'Não foi possível carregar o registo' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast, apptId]);

  const existingPhotosForPreview = useMemo(
    () =>
      photos
        .filter((p): p is typeof p & { file: { url: string } } => Boolean(p.file?.url))
        .map(p => ({
          id: p.id,
          url: p.file.url,
          name: p.file.name,
        })),
    [photos],
  );

  const submit = useCallback(async () => {
    if (!Number.isFinite(apptId)) return;
    try {
      const fd = new FormData();
      fd.append('notes', notes);
      if (summary.trim()) fd.append('summary', summary.trim());
      newFiles.forEach(f => fd.append('photos', f));

      await api.post(`/provider/appointments/${apptId}/record`, fd);
      addToast({ type: 'success', title: 'Registo guardado' });
      history.push('/provider');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro ao guardar',
        description: (err as any)?.response?.data?.error ?? 'Tenta novamente.',
      });
    }
  }, [addToast, apptId, history, newFiles, notes, summary]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto max-w-[720px] px-6 pb-20 pt-12">
        <Card className="mb-6 border-0 bg-[var(--color-black-medium)] text-[var(--color-text-white)] shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-[28px] font-semibold leading-tight text-[var(--color-text-white)]">
              Registar atendimento
            </CardTitle>
            <p className="text-sm leading-normal text-[var(--color-light-gray)]">
              Guarda notas e fotos do que foi feito. Se for uma marcação de{' '}
              <strong>avaliação</strong>, isto também liberta a cliente para marcar serviços que
              exigem avaliação.
            </p>
          </CardHeader>
          <CardContent>
            {loading && <p>A carregar…</p>}

            {!Number.isFinite(apptId) && <p>ID inválido.</p>}

            <TextField
              label="Título"
              value={summary}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSummary(e.target.value)}
              placeholder="Ex.: Avaliação + plano de tratamento"
              fullWidth
            />

            <div className="mb-4">
              <Label
                htmlFor="appointment-record-notes"
                className="mb-2 block font-normal text-[var(--color-light-gray)]"
              >
                Notas
              </Label>
              <Textarea
                id="appointment-record-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações, recomendações, preços indicados, fotos, etc."
                className="min-h-[180px] resize-y border-[var(--color-hard-gray)] placeholder:text-[var(--color-hard-gray)]"
              />
            </div>

            <div className="mb-4">
              <Label className="mb-2 block font-normal text-[var(--color-light-gray)]">
                Fotografias (opcional)
              </Label>
              <AppointmentRecordFileUploadPreview
                value={newFiles}
                onValueChange={setNewFiles}
                existingPhotos={existingPhotosForPreview}
                disabled={loading}
                onInvalid={msg => addToast({ type: 'error', title: msg })}
              />
            </div>

            <Button type="button" onClick={submit}>
              Guardar
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProviderAppointmentRecord;
