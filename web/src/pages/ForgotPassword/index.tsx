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
            .required('Required email')
            .email('Enter a valid email'),
        });
        await schema.validate(data, {
          abortEarly: false,
        });

        await api.post('/password/forgot', {
          email: data.email,
        });

        addToast({
          type: 'success',
          title: 'Email has been sent.',
          description:
            'An email has been sent to confirm your password recovery, please check your inbox.',
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
          title: 'Password Recovery Error',
          description:
            'An error occurred while attempting to recover your password, try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast],
  );
  return (
    <AuthLayout
      title="Password Recovery"
      backgroundImage={signInBackgroundImg}
      animationFrom="left"
    >
      <Form ref={formRef} onSubmit={handleFormSubmit}>
        <h1>Password Recovery</h1>

        <Input name="email" icon={FiMail} type="text" placeholder="Email" />
        <Button loading={loading} type="submit">
          Recover Password
        </Button>
      </Form>
      <Link to="/">
        <FiLogIn />
        Return to login
      </Link>
    </AuthLayout>
  );
};

export default ForgotPassword;
