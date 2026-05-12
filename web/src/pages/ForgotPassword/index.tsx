import React, { useRef, useCallback, useState } from 'react';
import { FiLogIn, FiMail } from 'react-icons/fi';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { Link } from 'react-router-dom';
import getValidationErrors from '../../utils/getValidationErrors';
import signInBackgroundImg from '../../assets/images/sign-in-background.jpg';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AuthLayout from '../../components/layouts/AuthLayout';
import { useToast } from '../../hooks/toast';
import api from '../../services/api';

interface ForgotPasswordFormData {
  email: string;
}
const ForgotPassword: React.FunctionComponent = () => {
  const [loading, setLoading] = useState(false);

  const formRef = useRef<FormHandles>(null);
  const { addToast } = useToast();
  const handleFormSubmit = useCallback(
    async (data: ForgotPasswordFormData) => {
      try {
        setLoading(true);

        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          email: Yup.string()
            .required('E-mail obrigatório')
            .email('Indica um e-mail válido'),
        });
        await schema.validate(data, {
          abortEarly: false,
        });

        await api.post('/password/forgot', {
          email: data.email,
        });

        addToast({
          type: 'success',
          title: 'E-mail enviado',
          description:
            'Revisa a tua caixa de entrada: enviámos um e-mail com instruções para recuperar a palavra-passe.',
        });
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          const r = formRef.current;
          if (r) r.setErrors(errors);

          return;
        }
        addToast({
          type: 'error',
          title: 'Erro ao recuperar palavra-passe',
          description: 'Não foi possível enviar o e-mail. Tenta novamente.',
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );
  return (
    <AuthLayout
      title="Recuperar palavra-passe"
      backgroundImage={signInBackgroundImg}
      animationFrom="left"
    >
      <Form ref={formRef} onSubmit={handleFormSubmit}>
        <h1>Recuperar palavra-passe</h1>

        <Input
          name="email"
          icon={FiMail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="E-mail"
        />
        <Button loading={loading} type="submit">
          Enviar instruções
        </Button>
      </Form>
      <Link to="/">
        <FiLogIn />
        Voltar ao início de sessão
      </Link>
    </AuthLayout>
  );
};

export default ForgotPassword;
