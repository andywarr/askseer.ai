"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { Check, X, MoreVertical, UserPlus } from "lucide-react";
import { TEAM_NAME_MAX_LENGTH } from "@/apps/shared/constants";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";
import type { Team, TeamMember, CompanyMember } from "./types";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";

function getJoinPolicyLabel(policy: TeamJoinPolicy, t: any) {
  const keys: Record<TeamJoinPolicy, string> = {
    INVITE_ONLY: "joinPolicies.inviteOnly.label",
    SECRET: "joinPolicies.secret.label",
    REQUEST_TO_JOIN: "joinPolicies.requestToJoin.label",
    SELF_JOIN: "joinPolicies.selfJoin.label",
    AUTO_JOIN: "joinPolicies.autoJoin.label",
  };
  return t(keys[policy]);
}

// Props for team columns factory
export interface TeamColumnsProps {
  t: any;
  locale: string;
  editingTeamId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  renamePending: boolean;
  renameIsValid: boolean;
  renameHasChanged: boolean;
  handleRenameSave: (team: Team) => void;
  handleRenameCancel: (team: Team) => void;
  canRenameTeam: (team: Team) => boolean;
  canInviteToTeam: (team: Team) => boolean;
  getAvailableMembersForTeam: (team: Team) => CompanyMember[];
  joinPolicyOverrides: Record<string, TeamJoinPolicy>;
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  setInviteDialogOpen: (open: boolean) => void;
  openInviteDialogOnSelectRef: React.MutableRefObject<boolean>;
}

export function createTeamColumns({
  t,
  locale,
  editingTeamId,
  renameValue,
  setRenameValue,
  renamePending,
  renameIsValid,
  renameHasChanged,
  handleRenameSave,
  handleRenameCancel,
  canRenameTeam,
  canInviteToTeam,
  getAvailableMembersForTeam,
  joinPolicyOverrides,
  selectedTeamId,
  setSelectedTeamId,
  setInviteDialogOpen,
  openInviteDialogOnSelectRef,
}: TeamColumnsProps): ColumnDef<Team>[] {
  return [
    {
      id: "name",
      header: t("columns.name"),
      accessorKey: "name",
      cell: ({ row }) => {
        const team = row.original;
        const isEditing = editingTeamId === team.id;

        if (isEditing) {
          return (
            <div
              className="flex items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={TEAM_NAME_MAX_LENGTH}
                disabled={renamePending}
                autoFocus
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!renamePending) {
                      handleRenameSave(team);
                    }
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleRenameCancel(team);
                  }
                }}
                aria-label={t("editTeamNameAria")}
                className="h-8 max-w-xs"
              />
              <Button
                className="group/save"
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRenameSave(team);
                }}
                disabled={renamePending || !renameIsValid || !renameHasChanged}
                aria-label={t("saveTeamNameAria")}
              >
                <Check className="h-4 w-4 group-hover/save:text-green-600" />
              </Button>
              <Button
                className="group/close"
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRenameCancel(team);
                }}
                disabled={renamePending}
                aria-label={t("cancelTeamRenameAria")}
              >
                <X className="h-4 w-4 group-hover/close:text-red-600" />
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <span className="truncate">{team.name}</span>
          </div>
        );
      },
    },
    {
      id: "isPersonal",
      header: t("columns.personal"),
      accessorKey: "isPersonal",
      cell: ({ row }) => (row.original.isPersonal ? t("yes") : t("no")),
    },
    {
      id: "joinPolicy",
      header: t("columns.joinStatus"),
      accessorKey: "joinPolicy",
      cell: ({ row }) => {
        const team = row.original;
        const policy = joinPolicyOverrides[team.id] ?? team.joinPolicy;

        if (team.isPersonal) {
          return t("notApplicable");
        }

        return getJoinPolicyLabel(policy, t);
      },
    },
    {
      id: "memberCount",
      header: t("columns.members"),
      accessorKey: "memberCount",
    },
    {
      id: "balanceCents",
      header: t("columns.balance"),
      accessorKey: "balanceCents",
      cell: ({ row }) => {
        const cents = row.original.balanceCents;
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(cents / 100);
      },
    },
    {
      id: "createdAt",
      header: t("columns.created"),
      accessorFn: (row) => new Date(row.createdAt).getTime(),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(locale),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 48,
      cell: ({ row }) => {
        const team = row.original;
        const canInvite = canInviteToTeam(team);
        const availableMembers = getAvailableMembersForTeam(team);
        const hasAvailableMembers = availableMembers.length > 0;
        const canShowAddMembers = canInvite && hasAvailableMembers;

        const getAddMembersTooltip = () => {
          if (team.isPersonal) {
            return t("personalTeamsCantInvite");
          }
          if (!canInvite) {
            return t("needTeamAdminToInvite");
          }
          if (!hasAvailableMembers) {
            return t("allMembersAlreadyInTeam");
          }
          return undefined;
        };

        const addMembersTooltip = getAddMembersTooltip();

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">{t("openMenuAria")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        disabled={!canShowAddMembers}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canShowAddMembers) return;
                          if (team.id !== selectedTeamId) {
                            openInviteDialogOnSelectRef.current = true;
                            setSelectedTeamId(team.id);
                          } else {
                            setInviteDialogOpen(true);
                          }
                        }}
                        onSelect={(e) => {
                          if (!canShowAddMembers) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t("addTeamMembersBtn")}
                      </DropdownMenuItem>
                    </span>
                  </TooltipTrigger>
                  {!canShowAddMembers && addMembersTooltip && (
                    <TooltipContent>
                      <p>{addMembersTooltip}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

// Props for team member columns factory
export interface TeamMemberColumnsProps {
  t: any;
  locale: string;
  currentUserId: string;
  currentTeamRole: string | null;
  canEdit: boolean;
  canChangeMemberRoles: boolean;
  canRemoveMembersFromSelectedTeam: boolean;
  memberRolePending: boolean;
  openMemberDropdownUserId: string | null;
  setOpenMemberDropdownUserId: (id: string | null) => void;
  setRemoveTarget: (member: TeamMember | null) => void;
  handleMemberRoleChange: (member: TeamMember, newRole: string) => void;
}

export function createTeamMemberColumns({
  t,
  locale,
  currentUserId,
  currentTeamRole,
  canEdit,
  canChangeMemberRoles,
  canRemoveMembersFromSelectedTeam,
  memberRolePending,
  openMemberDropdownUserId,
  setOpenMemberDropdownUserId,
  setRemoveTarget,
  handleMemberRoleChange,
}: TeamMemberColumnsProps): ColumnDef<TeamMember>[] {
  return [
    {
      id: "name",
      header: t("columns.name"),
      accessorFn: (row) => row.user.name || row.user.email,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {member.user.image ? (
                <AvatarImage src={member.user.image} />
              ) : (
                <AvatarFallback>
                  {getInitials(member.user.name || member.user.email)}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{member.user.name || member.user.email}</span>
          </div>
        );
      },
    },
    {
      id: "email",
      header: t("columns.email"),
      accessorFn: (row) => row.user.email,
      cell: ({ row }) => row.original.user.email,
    },
    {
      id: "role",
      header: t("columns.role"),
      accessorKey: "role",
      cell: ({ row }) => {
        const member = row.original;
        const memberRole = String(member.role || "").toUpperCase();
        const isCurrentUser = member.userId === currentUserId;
        // Only owners can change owner roles, admins can change member/viewer roles
        const canChangeThisMember =
          canChangeMemberRoles &&
          !isCurrentUser &&
          (currentTeamRole === "OWNER" ||
            canEdit ||
            (memberRole !== "OWNER" && currentTeamRole === "ADMIN"));

        if (canChangeThisMember) {
          // Determine available roles based on current user's role
          const availableRoles =
            currentTeamRole === "OWNER" || canEdit
              ? ["OWNER", "ADMIN", "MEMBER", "VIEWER"]
              : ["ADMIN", "MEMBER", "VIEWER"];

          return (
            <Select
              value={memberRole}
              onValueChange={(value) => handleMemberRoleChange(member, value)}
              disabled={memberRolePending}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r.toLowerCase()}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return <span className="capitalize">{t(`roles.${member.role.toLowerCase()}`)}</span>;
      },
    },
    {
      id: "joinedAt",
      header: t("columns.joined"),
      accessorFn: (row) => new Date(row.joinedAt).getTime(),
      cell: ({ row }) => new Date(row.original.joinedAt).toLocaleDateString(locale),
    },
    {
      id: "lastAccessedAt",
      header: t("columns.lastAccess"),
      accessorFn: (row) =>
        row.user.lastAccessedAt
          ? new Date(row.user.lastAccessedAt).getTime()
          : undefined,
      cell: ({ row }) =>
        row.original.user.lastAccessedAt
          ? new Date(row.original.user.lastAccessedAt).toLocaleDateString(locale)
          : "-",
      sortUndefined: 1,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("openMenuAria")}</span>,
      enableSorting: false,
      size: 48,
      cell: ({ row }) => {
        const member = row.original;
        const memberRole = String(member.role || "").toUpperCase();
        const canRemove =
          canRemoveMembersFromSelectedTeam &&
          member.userId !== currentUserId &&
          (!memberRole ||
            memberRole !== "OWNER" ||
            canEdit ||
            currentTeamRole === "OWNER");

        if (!canRemove) {
          return null;
        }

        return (
          <div className="flex justify-end">
            <DropdownMenu
              open={openMemberDropdownUserId === member.userId}
              onOpenChange={(open) => {
                setOpenMemberDropdownUserId(open ? member.userId : null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("openMenuAria")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-600"
                  onSelect={(event) => {
                    event.preventDefault();
                    setRemoveTarget(member);
                  }}
                >
                  {t("removeBtn")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
