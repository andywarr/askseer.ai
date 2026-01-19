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

const TEAM_JOIN_POLICY_LABELS: Record<TeamJoinPolicy, string> = {
  INVITE_ONLY: "Invite-only",
  SECRET: "Secret",
  REQUEST_TO_JOIN: "Request to join",
  SELF_JOIN: "Join",
  AUTO_JOIN: "Auto-join",
};

// Props for team columns factory
export interface TeamColumnsProps {
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
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => {
        const team = row.original;
        const isEditing = editingTeamId === team.id;
        const canRename = canRenameTeam(team);

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
                aria-label="Edit team name"
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
                aria-label="Save team name"
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
                aria-label="Cancel team rename"
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
      header: "Personal",
      accessorKey: "isPersonal",
      cell: ({ row }) => (row.original.isPersonal ? "Yes" : "No"),
    },
    {
      id: "joinPolicy",
      header: "Join status",
      accessorKey: "joinPolicy",
      cell: ({ row }) => {
        const team = row.original;
        const policy = joinPolicyOverrides[team.id] ?? team.joinPolicy;

        if (team.isPersonal) {
          return "N/A";
        }

        return TEAM_JOIN_POLICY_LABELS[policy];
      },
    },
    {
      id: "memberCount",
      header: "Members",
      accessorKey: "memberCount",
    },
    {
      id: "credits",
      header: "Credits",
      accessorKey: "credits",
    },
    {
      id: "createdAt",
      header: "Created",
      accessorFn: (row) => new Date(row.createdAt).getTime(),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString(),
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
            return "Personal teams can't receive invitations";
          }
          if (!canInvite) {
            return "You need to be a team admin to invite members";
          }
          if (!hasAvailableMembers) {
            return "All company members are already on this team";
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
                  <span className="sr-only">Open menu</span>
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
                        Add team members
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
      header: "Name",
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
      header: "Email",
      accessorFn: (row) => row.user.email,
      cell: ({ row }) => row.original.user.email,
    },
    {
      id: "role",
      header: "Role",
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
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return (
          <span className="capitalize">{member.role.toLowerCase()}</span>
        );
      },
    },
    {
      id: "joinedAt",
      header: "Joined",
      accessorFn: (row) => new Date(row.joinedAt).getTime(),
      cell: ({ row }) => new Date(row.original.joinedAt).toLocaleDateString(),
    },
    {
      id: "lastAccessedAt",
      header: "Last access",
      accessorFn: (row) =>
        row.user.lastAccessedAt
          ? new Date(row.user.lastAccessedAt).getTime()
          : undefined,
      cell: ({ row }) =>
        row.original.user.lastAccessedAt
          ? new Date(row.original.user.lastAccessedAt).toLocaleDateString()
          : "-",
      sortUndefined: 1,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
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
                  aria-label="More actions"
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
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
