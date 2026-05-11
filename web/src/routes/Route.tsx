import React from 'react';
import {
  Route as ReactDOMRoute,
  RouteProps as ReactRouterDOMProps,
  Redirect,
} from 'react-router-dom';
import { useAuth } from '../hooks/auth';
import { getHomePath } from '../utils/paths';

interface RouteProps extends ReactRouterDOMProps {
  isPrivate?: boolean;
  accessRole?: 'provider' | 'client' | 'any';
  skipRedirectIfAuthenticated?: boolean;
  component: React.ComponentType;
}

const Route: React.FC<RouteProps> = ({
  isPrivate = false,
  accessRole = 'any',
  skipRedirectIfAuthenticated = false,
  component: Component,
  ...rest
}) => {
  const { user } = useAuth();

  return (
    <ReactDOMRoute
      {...rest}
      render={({ location }) => {
        if (isPrivate && !user) {
          return (
            <Redirect
              to={{
                pathname: '/',
                state: { from: location },
              }}
            />
          );
        }

        if (isPrivate && user) {
          if (accessRole === 'provider' && !user.provider) {
            return (
              <Redirect
                to={{
                  pathname: '/client',
                  state: { from: location },
                }}
              />
            );
          }
          if (accessRole === 'client' && user.provider) {
            return (
              <Redirect
                to={{
                  pathname: '/provider',
                  state: { from: location },
                }}
              />
            );
          }
          return <Component />;
        }

        if (!isPrivate && user && !skipRedirectIfAuthenticated) {
          return (
            <Redirect
              to={{
                pathname: getHomePath(user),
                state: { from: location },
              }}
            />
          );
        }

        return <Component />;
      }}
    />
  );
};

export default Route;
