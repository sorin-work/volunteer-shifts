import { api, ApiError, onUnauthorized } from './api';
import type { User } from './types';

interface SessionState {
  user: User | null;
  loaded: boolean;
}

export const session: SessionState = $state({ user: null, loaded: false });

// The cookie expired or was revoked (e.g. password changed elsewhere): drop
// the user so the layout sends them to the sign-in page.
onUnauthorized(() => {
  session.user = null;
});

/** Loads the signed-in user once; a 401 just means nobody is signed in. */
export async function loadSession(): Promise<User | null> {
  try {
    const { user } = await api.get<{ user: User }>('/auth/me');
    session.user = user;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    session.user = null;
  } finally {
    session.loaded = true;
  }
  return session.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await api.post<{ user: User }>('/auth/login', { email, password });
  // Fetch /me so skills and other extras are included.
  return (await loadSession()) ?? user;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  birthDate?: string;
}): Promise<User> {
  const { user } = await api.post<{ user: User }>('/auth/register', input);
  session.user = user;
  session.loaded = true;
  return user;
}

export async function signOut(): Promise<void> {
  await api.post('/auth/logout');
  session.user = null;
}

export const isCoordinator = () => session.user?.role === 'coordinator';
