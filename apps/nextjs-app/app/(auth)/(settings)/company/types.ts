/**
 * Shared type definitions for the company settings page components.
 */

export interface Member {
  userId: string;
  role: string;
  canCreatePersonas: boolean;
  status: string;
  joinedAt: string;
  deactivatedAt?: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

export interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
}

export interface DomainUser {
  id: string;
  name: string | null;
  email: string;
}
