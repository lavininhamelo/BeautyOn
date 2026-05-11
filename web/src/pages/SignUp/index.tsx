import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiMail, FiUser, FiLock, FiPhone } from 'react-icons/fi';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { Link, useHistory } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import getValidationErrors from '../../utils/getValidationErrors';

import signUpBackgroundImg from '../../assets/images/sign-up-background.png';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AuthLayout from '../../components/layouts/AuthLayout';

interface SignUpFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface SignUpProps {
  registerAsProvider?: boolean;
}

const SignUp: React.FunctionComponent<SignUpProps> = ({
  registerAsProvider = false,
}) => {
  const formRef = useRef<FormHandles>(null);
  const { addToast } = useToast();
  const history = useHistory();

  const [claimPending, setClaimPending] = useState<null | {
    phone: string;
    email: string;
    password: string;
  }>(null);
  const [claimCode, setClaimCode] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const claimTitle = useMemo(() => {
    return 'Confirmar código';
  }, []);

  const submitClaimCode = useCallback(async () => {
    if (!claimPending) return;
    const code = claimCode.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(code)) {
      addToast({ type: 'error', title: 'Código inválido', description: 'Digite os 6 dígitos.' });
      return;
    }
    try {
      setClaimSubmitting(true);
      await api.post('/users/claim', {
        phone: claimPending.phone,
        email: claimPending.email,
        code,
        password: claimPending.password,
      });
      addToast({ type: 'success', title: 'Conta criada', description: 'Já pode iniciar sessão.' });
      setClaimPending(null);
      history.push('/');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro',
        description: (err as any)?.response?.data?.error ?? 'Não foi possível confirmar o código.',
      });
    } finally {
      setClaimSubmitting(false);
    }
  }, [addToast, claimCode, claimPending, history]);

  const handleFormSubmit = useCallback(
    async (data: SignUpFormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          name: Yup.string().required('Nome obrigatório'),
          email: Yup.string()
            .required('Email obrigatório')
            .email('Email inválido'),
          phone: Yup.string()
            .required('Telemóvel obrigatório')
            .min(8, 'Telemóvel inválido')
            .max(32, 'Telemóvel inválido'),
          password: Yup.string().min(
            6,
            'A palavra-passe deve ter pelo menos 6 caracteres',
          ),
        });
        await schema.validate(data, {
          abortEarly: false,
        });
        await api.post('/users', {
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.password,
          provider: registerAsProvider,
        });
        history.push('/');
        addToast({
          type: 'success',
          title: 'Conta criada',
          description: 'Já pode iniciar sessão na BeautyOn.',
        });
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          const r = formRef.current;
          if (r) r.setErrors(errors);

          return;
        }
        const apiErr = err as any;
        const code = apiErr?.response?.data?.code;
        if (code === 'CLIENT_CLAIM_REQUIRED') {
          try {
            setClaimSubmitting(true);
            const resp = await api.post<{ ok: boolean; eligible?: boolean }>(
              '/users/claim-request',
              { phone: data.phone, email: data.email },
            );
            if (!resp.data?.eligible) {
              addToast({
                type: 'error',
                title: 'Não encontrado',
                description:
                  'Não encontramos este cliente cadastrado (ou já tem conta). Confirma o telemóvel.',
              });
              return;
            }
            setClaimPending({ phone: data.phone, email: data.email, password: data.password });
            setClaimCode('');
            addToast({
              type: 'success',
              title: 'Código enviado',
              description: 'Enviámos um código (mock SMS) para o teu e-mail.',
            });
          } catch (e) {
            addToast({
              type: 'error',
              title: 'Erro',
              description:
                (e as any)?.response?.data?.error ?? 'Não foi possível enviar o código.',
            });
          } finally {
            setClaimSubmitting(false);
          }
          return;
        }
        addToast({
          type: 'error',
          title: 'Erro no registo',
          description: 'Tente novamente.',
        });
      }
    },
    [addToast, history, registerAsProvider],
  );

  const title = registerAsProvider
    ? 'Conta de profissional'
    : 'Criar conta de cliente';

  return (
    <AuthLayout
      title={title}
      backgroundImage={signUpBackgroundImg}
      animationFrom="right"
    >
      <Form ref={formRef} onSubmit={handleFormSubmit}>
        <h1>{title}</h1>

        <Input name="name" icon={FiUser} type="text" placeholder="Nome" />
        <Input name="email" icon={FiMail} type="text" placeholder="Email" />
        <Input name="phone" icon={FiPhone} type="tel" placeholder="Telemóvel" />
        <Input
          name="password"
          icon={FiLock}
          type="password"
          placeholder="Palavra-passe"
        />
        <Button type="submit" disabled={claimSubmitting}>
          {claimSubmitting ? 'A processar…' : 'Registar'}
        </Button>
      </Form>
      <Link to="/">
        <FiArrowLeft />
        Voltar ao login
      </Link>
      {registerAsProvider ? (
        <Link to="/signup">Sou cliente</Link>
      ) : (
        <Link to="/signup/provider">Sou profissional</Link>
      )}

      {!!claimPending && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-6"
          onClick={() => !claimSubmitting && setClaimPending(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-[14px] border border-white/[0.08] bg-[var(--color-black-medium)] p-5"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-2">{claimTitle}</h2>
            <p className="mb-3.5 text-sm leading-snug text-[var(--color-light-gray)]">
              Digite os 6 dígitos enviados (mock SMS) para o seu e-mail e clique em criar conta.
            </p>

            <input
              className="mb-4 mt-1 h-[54px] w-full rounded-xl border border-white/[0.12] bg-white/[0.04] text-center text-[22px] font-extrabold tracking-[0.5em] text-[var(--color-text-white)]"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              placeholder="______"
              value={claimCode}
              onChange={e => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button type="button" onClick={submitClaimCode} disabled={claimSubmitting}>
                {claimSubmitting ? 'A confirmar…' : 'Criar conta'}
              </Button>
              <Button type="button" onClick={() => setClaimPending(null)} disabled={claimSubmitting}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default SignUp;
