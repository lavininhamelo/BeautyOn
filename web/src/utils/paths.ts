import type { AuthUser } from './mapApiUser';

export function getHomePath(user: Pick<AuthUser, 'provider'> | undefined): string {
  if (!user || user.provider === undefined) {
    return '/client';
  }
  return user.provider ? '/provider' : '/client';
}
