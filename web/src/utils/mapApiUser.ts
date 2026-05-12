export interface ApiUserResponse {
  id: number | string;
  name: string;
  email: string;
  phone?: string | null;
  provider?: boolean;
  avatar?: { id: number; name?: string; path?: string | null; url: string } | null;
  avatar_url?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  provider?: boolean;
}

export function mapApiUser(api: ApiUserResponse): AuthUser {
  const url = api.avatar?.url ?? api.avatar_url;
  return {
    id: String(api.id),
    name: api.name,
    email: api.email,
    phone: typeof api.phone === 'string' ? api.phone : undefined,
    avatar_url: typeof url === 'string' ? url : undefined,
    provider: typeof api.provider === 'boolean' ? api.provider : undefined,
  };
}
