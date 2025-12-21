import type { User } from '../db/types.js';

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: User['role'];
  phone: string | null;
  birthDate: string | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    birthDate: user.birth_date,
  };
}
