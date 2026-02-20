// Shared types for credits page components

export interface TeamMember {
  userId: string;
  role: string;
}

export interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  balanceCents: number;
  companyId?: string | null;
  companyPersonalTeamsDisabled?: boolean;
  members?: TeamMember[];
  role?: string; // User's role in the team (from getUserTeams)
}

export interface CompanyMembership {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface TeamForDisplay {
  id: string;
  name: string;
  isPersonal: boolean;
  balanceCents: number;
  companyId?: string | null;
}

// Helper functions
export function isAdminOrOwner(role: string | undefined | null): boolean {
  const normalizedRole = String(role || "").toUpperCase();
  return normalizedRole === "ADMIN" || normalizedRole === "OWNER";
}

export function getUserTeamRole(team: Team, userId: string): string {
  const member = team.members?.find((m) => m.userId === userId);
  return String(member?.role || "").toUpperCase();
}

export function mapTeamForDisplay(team: Team): TeamForDisplay {
  return {
    id: team.id,
    name: team.isPersonal ? `${team.name} (Personal)` : team.name,
    isPersonal: Boolean(team.isPersonal),
    balanceCents: team.balanceCents ?? 0,
    companyId: team.companyId ?? null,
  };
}
