import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import SignIn from '../../pages/SignIn';

const mockedHistoryPush = jest.fn();
const mockedSignIn = jest.fn();
const mockedAddToast = jest.fn();

jest.mock('react-router-dom', () => {
  return {
    useHistory: () => ({
      push: mockedHistoryPush,
    }),
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('../../hooks/auth', () => {
  return {
    useAuth: () => ({
      signIn: mockedSignIn,
    }),
  };
});

const mockClientUser = {
  id: '1',
  name: 'John Doe',
  email: 'johndoe@example.com',
  provider: false,
};

jest.mock('../../hooks/toast', () => {
  return {
    useToast: () => ({
      addToast: mockedAddToast,
    }),
  };
});

describe('SignIn Page', () => {
  beforeEach(() => {
    mockedHistoryPush.mockClear();
  });

  it('should be able to sign in', async () => {
    mockedSignIn.mockResolvedValue(mockClientUser);

    const { getByPlaceholderText, getByRole } = render(<SignIn />);

    const emailField = getByPlaceholderText('Email');
    const passwordField = getByPlaceholderText('Palavra-passe');
    const buttonElement = getByRole('button', { name: 'Iniciar sessão' });

    fireEvent.change(emailField, { target: { value: 'johndoe@example.com' } });
    fireEvent.change(passwordField, { target: { value: 'password-test' } });

    fireEvent.click(buttonElement);

    await waitFor(() => {
      expect(mockedHistoryPush).toHaveBeenCalledWith('/client');
    });
  });

  it('should not be able to sign in with invalid credentials', async () => {
    const { getByPlaceholderText, getByRole } = render(<SignIn />);

    const emailField = getByPlaceholderText('Email');
    const passwordField = getByPlaceholderText('Palavra-passe');
    const buttonElement = getByRole('button', { name: 'Iniciar sessão' });

    fireEvent.change(emailField, { target: { value: 'not-valid-email' } });
    fireEvent.change(passwordField, { target: { value: 'password-test' } });

    fireEvent.click(buttonElement);

    await waitFor(() => {
      expect(mockedHistoryPush).not.toHaveBeenCalled();
    });
  });

  it('should display an error if login fails', async () => {
    mockedSignIn.mockImplementation(() => {
      throw new Error();
    });

    const { getByPlaceholderText, getByRole } = render(<SignIn />);

    const emailField = getByPlaceholderText('Email');
    const passwordField = getByPlaceholderText('Palavra-passe');
    const buttonElement = getByRole('button', { name: 'Iniciar sessão' });

    fireEvent.change(emailField, { target: { value: 'johndoe@example.com' } });
    fireEvent.change(passwordField, { target: { value: 'password-test' } });

    fireEvent.click(buttonElement);

    await waitFor(() => {
      expect(mockedAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });
});
