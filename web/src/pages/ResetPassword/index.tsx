import React, { useRef, useCallback } from 'react';
import { FiLock } from 'react-icons/fi';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { useHistory, useLocation } from 'react-router-dom';
import getValidationErrors from '../../utils/getValidationErrors';
import signInBackgroundImg from '../../assets/images/sign-in-background.jpg';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AuthLayout from '../../components/layouts/AuthLayout';
import { useToast } from '../../hooks/toast';
import api from '../../services/api';

interface ResetPasswordFormData {
  password: string;
  password_confirmation: string;
}
const ResetPassword: React.FunctionComponent = () => {
  const formRef = useRef<FormHandles>(null);

  const { addToast } = useToast();

  const history = useHistory();

  const location = useLocation();

  const handleFormSubmit = useCallback(
    async (data: ResetPasswordFormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          password: Yup.string().required('Palavra-passe obrigatória'),
          password_confirmation: Yup.string().oneOf(
            [Yup.ref('password'), undefined],
            'As palavras-passe devem coincidir',
          ),
        });
        await schema.validate(data, {
          abortEarly: false,
        });

        const { password, password_confirmation } = data;

        const token = location.search.replace('?token=', '');

        if (!token) {
          throw new Error();
        }

        await api.post('/password/reset', {
          password,
          password_confirmation,
          token,
        });

        history.push('/');
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          const r = formRef.current;
          if (r) r.setErrors(errors);

          return;
        }
        addToast({
          type: 'error',
          title: 'Erro ao redefinir palavra-passe',
          description:
            'Não foi possível redefinir a palavra-passe. Tenta novamente.',
        });
      }
    },
    [addToast, history, location.search],
  );
  return (
    <AuthLayout
      title="Redefinir palavra-passe"
      backgroundImage={signInBackgroundImg}
      animationFrom="left"
    >
      <Form ref={formRef} onSubmit={handleFormSubmit}>
        <h1>Redefinir palavra-passe</h1>

        <Input
          name="password"
          icon={FiLock}
          type="password"
          placeholder="Nova palavra-passe"
        />

        <Input
          name="password_confirmation"
          icon={FiLock}
          type="password"
          placeholder="Confirmar nova palavra-passe"
        />

        <Button type="submit">Redefinir palavra-passe</Button>
      </Form>
    </AuthLayout>
  );
};

export default ResetPassword;
