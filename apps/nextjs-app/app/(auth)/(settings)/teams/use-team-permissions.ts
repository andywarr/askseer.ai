"use client";

import { useMemo } from "react";
import type { Team } from "./types";

interface TeamPermissions {
  currentTeamRole: string | null;
  canRename: boolean;
  canInvite: boolean;
  canUpdateJoinPolicy: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
  canDelete: boolean;
}

/**
 * Hook to compute team permissions based on user role and company permissions
 */
export function useTeamPermissions(
  team: Team | null,
  currentUserId: string,
  canEdit: boolean,
): TeamPermissions {
  const currentTeamRole = useMemo(() => {
    if (!team) return null;
    const membership = team.members.find(
      (member) => member.userId === currentUserId,
    );
    return membership ? String(membership.role || "").toUpperCase() : null;
  }, [team, currentUserId]);

  const isTeamAdmin =
    currentTeamRole === "OWNER" || currentTeamRole === "ADMIN";

  const canRename = useMemo(() => {
    if (!team) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  const canInvite = useMemo(() => {
    if (!team || team.isPersonal) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  const canUpdateJoinPolicy = useMemo(() => {
    if (!team || team.isPersonal) return false;
    if (team.isDefaultForCompany) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  const canRemoveMembers = useMemo(() => {
    if (!team || team.isPersonal) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  const canChangeRoles = useMemo(() => {
    if (!team || team.isPersonal) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  const canDelete = useMemo(() => {
    if (!team || team.isPersonal || team.isDefaultForCompany) return false;
    if (canEdit) return true;
    return isTeamAdmin;
  }, [team, canEdit, isTeamAdmin]);

  return {
    currentTeamRole,
    canRename,
    canInvite,
    canUpdateJoinPolicy,
    canRemoveMembers,
    canChangeRoles,
    canDelete,
  };
}

/**
 * Check if a user can rename a specific team
 */
export function canRenameTeam(
  team: Team,
  currentUserId: string,
  canEdit: boolean,
): boolean {
  if (canEdit) return true;
  const membership = team.members.find(
    (member) => member.userId === currentUserId,
  );
  const role = String(membership?.role || "").toUpperCase();
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Check if a user can invite members to a specific team
 */
export function canInviteToTeam(
  team: Team,
  currentUserId: string,
  canEdit: boolean,
): boolean {
  if (team.isPersonal) return false;
  if (canEdit) return true;
  const membership = team.members.find(
    (member) => member.userId === currentUserId,
  );
  const role = String(membership?.role || "").toUpperCase();
  return role === "OWNER" || role === "ADMIN";
}
