import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiLock, FiMail, FiPhone } from 'react-icons/fi';

import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import getValidationErrors from '../../utils/getValidationErrors';

import signUpBackgroundImg from '../../assets/images/sign-up-background.png';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AuthLayout from '../../components/layouts/AuthLayout';

interface FormData {
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type ClaimPrefillState = Partial<Pick<FormData, 'phone' | 'email'>>;

const ClaimAccount: React.FC = () => {
  const formRef = useRef<FormHandles>(null);
  const { addToast } = useToast();
  const history = useHistory();
  const location = useLocation<ClaimPrefillState | undefined>();
  const [pending, setPending] = useState<null | { phone: string; email: string; password: string }>(null);
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);

  const initialData = useMemo(() => {
    const st = location.state || {};
    return {
      phone: st.phone ?? '',
      email: st.email ?? '',
    };
  }, [location.state]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          phone: Yup.string().min(8).max(32).required('Telemóvel obrigatório'),
          email: Yup.string().email('E-mail inválido').required('E-mail obrigatório'),
          password: Yup.string()
            .min(6, 'A palavra-passe deve ter pelo menos 6 caracteres')
            .required('Palavra-passe obrigatória'),
          confirmPassword: Yup.string()
            .oneOf([Yup.ref('password')], 'Não coincide com a palavra-passe')
            .required('Confirmação obrigatória'),
        });
        await schema.validate(data, { abortEarly: false });

        setSubmitting(true);

        const resp = await api.post<{ ok: boolean; eligible?: boolean; debug_code?: string }>(
          '/users/claim-request',
          {
          phone: data.phone,
          email: data.email,
          },
        );

        if (!resp.data?.eligible) {
          addToast({
            type: 'error',
            title: 'Não encontrado',
            description:
              'Não encontramos este cliente cadastrado (ou já tem conta). Confirma o telemóvel ou pede ao salão para cadastrar primeiro.',
          });
          return;
        }

        setPending({ phone: data.phone, email: data.email, password: data.password });
        setCode(['', '', '', '', '', '']);
        addToast({ type: 'success', title: 'Código enviado', description: 'Enviámos um código (mock SMS) para o teu e-mail.' });
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const r = formRef.current;
          if (r) r.setErrors(getValidationErrors(err));
          return;
        }
        addToast({
          type: 'error',
          title: 'Erro',
          description: (err as any)?.response?.data?.error ?? 'Não foi possível enviar o código. Tente novamente.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [addToast],
  );

  const submitCode = useCallback(async () => {
    if (!pending) return;
    const codeStr = code.join('');
    if (!/^\d{6}$/.test(codeStr)) {
      addToast({ type: 'error', title: 'Código inválido', description: 'Digite os 6 dígitos.' });
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/users/claim', {
        phone: pending.phone,
        email: pending.email,
        code: codeStr,
        password: pending.password,
      });
      addToast({ type: 'success', title: 'Conta criada', description: 'Já pode iniciar sessão.' });
      history.push('/');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro',
        description: (err as any)?.response?.data?.error ?? 'Não foi possível confirmar o código.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [addToast, code, history, pending]);

  return (
    <AuthLayout
      title="Concluir registo"
      backgroundImage={signUpBackgroundImg}
      animationFrom="right"
    >
      <Form ref={formRef} onSubmit={onSubmit} initialData={initialData}>
        <h1>Concluir registo</h1>

        <Input name="phone" icon={FiPhone} placeholder="Telemóvel" />
        <Input name="email" icon={FiMail} placeholder="E-mail" />
        <Input
          name="password"
          icon={FiLock}
          type="password"
          placeholder="Nova palavra-passe"
        />
        <Input
          name="confirmPassword"
          icon={FiLock}
          type="password"
          placeholder="Confirmar palavra-passe"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'A enviar…' : 'Enviar código'}
        </Button>
      </Form>

      <Link to="/">
        <FiArrowLeft />
        Voltar ao login
      </Link>

      {!!pending && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-6"
          onClick={() => !submitting && setPending(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-[14px] border border-white/[0.08] bg-[var(--color-black-medium)] p-5"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-2">Confirmar código</h2>
            <p className="mb-3.5 text-sm leading-snug text-[var(--color-light-gray)]">
              Digite os 6 dígitos enviados (mock SMS) para o seu e-mail e clique em criar conta.
            </p>

            <div className="my-3.5 flex justify-center gap-2.5">
              {code.map((v, idx) => (
                <input
                  key={String(idx)}
                  className="h-[54px] w-[46px] rounded-xl border border-white/[0.12] bg-white/[0.04] text-center text-[22px] font-extrabold text-[var(--color-text-white)]"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={v}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(-1);
                    setCode(prev => {
                      const next = prev.slice();
                      next[idx] = raw;
                      return next;
                    });
                    const nextEl = (e.target as HTMLInputElement).nextElementSibling as HTMLInputElement | null;
                    if (raw && nextEl) nextEl.focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !code[idx]) {
                      const prevEl = (e.currentTarget as HTMLInputElement).previousElementSibling as HTMLInputElement | null;
                      if (prevEl) prevEl.focus();
                    }
                  }}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button type="button" onClick={submitCode} disabled={submitting}>
                {submitting ? 'A confirmar…' : 'Criar conta'}
              </Button>
              <Button type="button" onClick={() => setPending(null)} disabled={submitting}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default ClaimAccount;
