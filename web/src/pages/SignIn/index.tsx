import React, { useRef, useCallback } from 'react';
import { FiLogIn, FiMail, FiLock } from 'react-icons/fi';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { Link, useHistory } from 'react-router-dom';
import getValidationErrors from '../../utils/getValidationErrors';
import { getHomePath } from '../../utils/paths';
import signInBackgroundImg from '../../assets/images/sign-in-background.jpg';
import Input from '../../components/Input';
import Button from '../../components/Button';
import AuthLayout from '../../components/layouts/AuthLayout';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';

interface SignInFormData {
  email: string;
  password: string;
}
const SignIn: React.FunctionComponent = () => {
  const formRef = useRef<FormHandles>(null);
  const { signIn } = useAuth();
  const { addToast } = useToast();
  const history = useHistory();
  const handleFormSubmit = useCallback(
    async (data: SignInFormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          email: Yup.string()
            .required('Email obrigatório')
            .email('Email inválido'),
          password: Yup.string().required('Palavra-passe obrigatória'),
        });
        await schema.validate(data, {
          abortEarly: false,
        });
        const loggedUser = await signIn({
          email: data.email,
          password: data.password,
        });
        history.push(getHomePath(loggedUser));
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          const r = formRef.current;
          if (r) r.setErrors(errors);

          return;
        }
        addToast({
          type: 'error',
          title: 'Authentication Error',
          description:
            'Username ou login inválidos, por favor verifique as suas credenciais.',
        });
      }
    },
    [signIn, addToast, history],
  );
  return (
    <AuthLayout
      title="Iniciar sessão"
      backgroundImage={signInBackgroundImg}
      animationFrom="left"
    >
      <Form ref={formRef} onSubmit={handleFormSubmit}>
        <h1>Iniciar sessão</h1>

        <Input name="email" icon={FiMail} type="text" placeholder="Email" />
        <Input
          name="password"
          icon={FiLock}
          type="password"
          placeholder="Palavra-passe"
        />
        <Button type="submit">Iniciar sessão</Button>
        <Link to="/forgot-password">Esqueceu a sua palavra-passe?</Link>
      </Form>
      <Link to="/signup">
        <FiLogIn />
        Criar conta (cliente)
      </Link>
      <Link to="/signup/provider">Registo profissional</Link>
      <Link to="/book">Agendar sem conta</Link>
    </AuthLayout>
  );
};

export default SignIn;
