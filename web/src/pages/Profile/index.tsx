import React, { ChangeEvent, useCallback, useRef } from 'react';
import { FiMail, FiUser, FiLock, FiCamera, FiArrowLeft, FiPhone } from 'react-icons/fi';
import { Form } from '@unform/web';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import { Link, useHistory } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import getValidationErrors from '../../utils/getValidationErrors';
import { mapApiUser } from '../../utils/mapApiUser';
import { getHomePath } from '../../utils/paths';

import Input from '../../components/Input';
import Button from '../../components/Button';
import { useAuth } from '../../hooks/auth';

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  old_password: string;
  password: string;
  password_confirmation: string;
}
const Profile: React.FunctionComponent = () => {
  const formRef = useRef<FormHandles>(null);
  const { addToast } = useToast();
  const history = useHistory();

  const { user, updateUser } = useAuth();

  const handleFormSubmit = useCallback(
    async (data: ProfileFormData) => {
      try {
        const r = formRef.current;
        if (r) r.setErrors({});
        const schema = Yup.object().shape({
          name: Yup.string().required('Nome obrigatório'),
          email: Yup.string()
            .required('Email obrigatório')
            .email('Email inválido'),
          phone: Yup.string()
            .min(8, 'Telemóvel inválido')
            .max(32, 'Telemóvel inválido')
            .required('Telemóvel obrigatório'),
          old_password: Yup.string(),
          password: Yup.string().when('old_password', {
            is: value => !!value.length,
            then: Yup.string()
              .required('Palavra-passe obrigatória')
              .min(6, 'A palavra-passe deve ter pelo menos 6 caracteres'),
            otherwise: Yup.string(),
          }),
          password_confirmation: Yup.string()
            .when('old_password', {
              is: value => !!value.length,
              then: Yup.string().required('Palavra-passe obrigatória'),
              otherwise: Yup.string(),
            })
            .oneOf([Yup.ref('password'), undefined], 'As palavras-passe devem coincidir'),
        });

        await schema.validate(data, {
          abortEarly: false,
        });

        const {
          name,
          email,
          phone,
          old_password,
          password,
          password_confirmation,
        } = data;

        const response = await api.put('/users', {
          name,
          email,
          phone,
          ...(old_password
            ? {
                oldPassword: old_password,
                password,
                confirmPassword: password_confirmation,
              }
            : {}),
        });

        const updated = mapApiUser(response.data);
        updateUser(updated);

        history.push(getHomePath(updated));

        addToast({
          type: 'success',
          title: 'Profile Updated',
          description: 'Your profile information was successfully updated!',
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
          title: 'Erro ao atualizar o perfil',
          description: 'Ocorreu um erro ao tentar atualizar o seu perfil, por favor tente novamente.',
        });
      }
    },
    [history, addToast, updateUser],
  );

  const handleAvatarChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) {
        return;
      }
      const data = new FormData();
      data.append('avatar', e.target.files[0]);

      try {
        const response = await api.post('/users/avatar', data);
        updateUser(mapApiUser(response.data));
        addToast({
          type: 'success',
          title: 'Avatar atualizado!',
        });
      } catch {
        addToast({
          type: 'error',
          title: 'Não foi possível atualizar o avatar',
        });
      }
    },
    [addToast, updateUser],
  );

  return (
    <div className="h-screen">
      <header className="flex h-36 items-center bg-[var(--color-black-medium)]">
        <div className="mx-auto w-full max-w-[1120px]">
          <Link to={getHomePath(user)}>
            <FiArrowLeft className="h-6 w-6 text-[var(--color-light-gray)]" />
          </Link>
        </div>
      </header>

      <div className="-mt-[176px] mx-auto flex w-full flex-col items-center justify-center">
        <Form
          ref={formRef}
          initialData={{
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
          }}
          onSubmit={handleFormSubmit}
          className="my-20 flex w-[340px] flex-col space-y-3 text-center"
        >
          <div className="relative mb-8 self-center">
            <img
              className="h-[186px] w-[186px] rounded-full"
              src={
                user.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?backgroundColor=ffd2e4&&seed=${encodeURIComponent(
                  user.name,
                )}`
              }
              alt={user.name}
            />
            <label
              htmlFor="avatar"
              className="absolute bottom-0 right-0 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-darken)]"
            >
              <FiCamera className="h-5 w-5 text-[var(--color-background)]" />
              <input type="file" id="avatar" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

          <h1 className="mb-6 self-stretch text-left text-xl">Meu perfil:</h1>

          <Input name="name" icon={FiUser} type="text" placeholder="Name" />
          <Input name="email" icon={FiMail} type="text" placeholder="Email" />
          <Input
            name="phone"
            icon={FiPhone}
            type="tel"
            placeholder="Telemóvel"
          />
          <Input
            containerStyle={{ marginTop: 24 }}
            name="old_password"
            icon={FiLock}
            type="password"
            placeholder="Palavra-passe atual"
          />
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
          <Button type="submit">Confirmar alterações</Button>
        </Form>
      </div>
    </div>
  );
};

export default Profile;
