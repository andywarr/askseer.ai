import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
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
  description?: string | null;
  joinPolicy: TeamJoinPolicy;
  isPersonal: boolean;
  isDefaultForCompany: boolean;
  balanceCents: number;
  createdAt: string;
  memberCount: number;
  studyCount: number;
  members: TeamMember[];
}

export interface CompanyMember {
  userId: string;
  role: string;
  status?: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

export interface JoinRequest {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  requestNote?: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string;
  };
}
