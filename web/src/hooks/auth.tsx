import React, { createContext, useCallback, useState, useContext } from 'react';
import api from '../services/api';
import { mapApiUser, AuthUser } from '../utils/mapApiUser';

interface User extends AuthUser {}

interface SignInCredentials {
  email: string;
  password: string;
}
interface AuthContextProps {
  user: User;
  signIn(credentials: SignInCredentials): Promise<User>;
  signOut(): void;
  updateUser(user: User): void;
}

interface AuthDataProps {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

const AuthProvider: React.FC = ({ children }) => {
  const [authData, setAuthData] = useState<AuthDataProps>(() => {
    const token = localStorage.getItem('@BeautyOn:token');
    const user = localStorage.getItem('@BeautyOn:user');
    if (token && user) {
      api.defaults.headers.authorization = `Bearer ${token}`;
      try {
        const parsed = JSON.parse(user);
        return { token, user: mapApiUser(parsed) };
      } catch {
        return {} as AuthDataProps;
      }
    }

    return {} as AuthDataProps;
  });
  const signIn = useCallback(async ({ email, password }: SignInCredentials) => {
    const response = await api.post('/sessions', {
      email,
      password,
    });

    const { token, user: rawUser } = response.data;
    const user = mapApiUser(rawUser);

    localStorage.setItem('@BeautyOn:token', token);
    localStorage.setItem('@BeautyOn:user', JSON.stringify(user));

    api.defaults.headers.authorization = `Bearer ${token}`;

    setAuthData({ token, user });
    return user;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('@BeautyOn:token');
    localStorage.removeItem('@BeautyOn:user');

    setAuthData({} as AuthDataProps);
  }, []);

  const updateUser = useCallback(
    (user: User) => {
      localStorage.setItem('@BeautyOn:user', JSON.stringify(user));

      setAuthData({
        token: authData.token,
        user,
      });
    },
    [setAuthData, authData.token],
  );

  return (
    <AuthContext.Provider
      value={{ user: authData.user, signIn, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

function useAuth(): AuthContextProps {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export { AuthProvider, useAuth };
