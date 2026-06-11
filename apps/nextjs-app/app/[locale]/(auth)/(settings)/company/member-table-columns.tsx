"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Member } from "./types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";

const ROLES = ["OWNER", "ADMIN", "BILLING", "MEMBER", "VIEWER"];

export interface MemberTableColumnsConfig {
  canEdit: boolean;
  currentUserId: string;
  isCurrentUserOwner: boolean;
  isCurrentUserAdmin: boolean;
  membershipPending: boolean;
  allCanCreatePersonas: boolean;
  someCanCreatePersonas: boolean;
  openDropdownUserId: string | null;
  onRoleChange: (userId: string, role: string) => void;
  onPermissionChange: (userId: string, canCreatePersonas: boolean) => void;
  onToggleAllPermissions: (canCreatePersonas: boolean) => void;
  onDropdownOpenChange: (userId: string | null) => void;
  onDeactivate: (member: Member) => void;
  onActivate: (member: Member) => void;
  onErase: (member: Member) => void;
  t: any;
  locale: string;
}

export function createMemberTableColumns(
  config: MemberTableColumnsConfig,
): ColumnDef<Member>[] {
  const {
    canEdit,
    currentUserId,
    isCurrentUserOwner,
    isCurrentUserAdmin,
    membershipPending,
    allCanCreatePersonas,
    someCanCreatePersonas,
    openDropdownUserId,
    onRoleChange,
    onPermissionChange,
    onToggleAllPermissions,
    onDropdownOpenChange,
    onDeactivate,
    onActivate,
    onErase,
    t,
    locale,
  } = config;

  return [
    {
      id: "name",
      header: t("nameColHeader"),
      accessorFn: (row) => row.user.name || row.user.email,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {m.user.image ? (
                <AvatarImage src={m.user.image} />
              ) : (
                <AvatarFallback>
                  {getInitials(m.user.name || m.user.email)}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{m.user.name || m.user.email}</span>
          </div>
        );
      },
    },
    {
      id: "email",
      header: t("emailColHeader"),
      accessorFn: (row) => row.user.email,
      cell: ({ row }) => row.original.user.email,
    },
    {
      id: "status",
      header: t("statusColHeader"),
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status || "ACTIVE";
        const display = t("status." + status.toLowerCase());
        const variant =
          status === "ACTIVE"
            ? "secondary"
            : status === "DEACTIVATED"
              ? "destructive"
              : "outline";
        return <Badge variant={variant}>{display}</Badge>;
      },
    },
    {
      id: "role",
      header: t("roleColHeader"),
      accessorKey: "role",
      cell: ({ row }) => {
        const m = row.original;
        const isDeactivated = m.status === "DEACTIVATED";
        return canEdit && m.userId !== currentUserId ? (
          <Select
            value={m.role}
            onValueChange={(value) => onRoleChange(m.userId, value)}
            disabled={membershipPending || isDeactivated}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t("roles." + r.toLowerCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span>{t("roles." + m.role.toLowerCase())}</span>
        );
      },
    },
    {
      id: "canCreatePersonas",
      header: () => (
        <div className="flex items-center gap-2">
          <Checkbox
            aria-label={t("togglePersonaAllAria")}
            checked={
              allCanCreatePersonas
                ? true
                : someCanCreatePersonas
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) =>
              onToggleAllPermissions(Boolean(checked))
            }
            disabled={!canEdit || membershipPending}
          />
          <span>{t("createPersonasColHeader")}</span>
        </div>
      ),
      cell: ({ row }) => {
        const m = row.original;
        const isDeactivated = m.status === "DEACTIVATED";
        return (
          <Checkbox
            aria-label={t("allowPersonaUserAria", { name: m.user.name || m.user.email })}
            checked={m.canCreatePersonas}
            onCheckedChange={(checked) =>
              onPermissionChange(m.userId, Boolean(checked))
            }
            disabled={!canEdit || membershipPending || isDeactivated}
          />
        );
      },
      enableSorting: false,
    },
    {
      id: "joinedAt",
      header: t("joinedColHeader"),
      accessorFn: (row) => new Date(row.joinedAt).getTime(),
      cell: ({ row }) => new Date(row.original.joinedAt).toLocaleDateString(locale),
    },
    {
      id: "lastAccessedAt",
      header: t("lastAccessColHeader"),
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
      header: () => <span className="sr-only">{t("actionsColHeader")}</span>,
      cell: ({ row }) => {
        const member = row.original;
        const canRemove =
          canEdit &&
          member.userId !== currentUserId &&
          (member.role !== "OWNER" || isCurrentUserOwner) &&
          member.status === "ACTIVE";
        const canActivateMember =
          canEdit &&
          member.userId !== currentUserId &&
          member.status === "DEACTIVATED";
        const canEraseMember =
          isCurrentUserAdmin && member.userId !== currentUserId;

        if (!canRemove && !canActivateMember && !canEraseMember) {
          return null;
        }

        return (
          <div className="flex justify-end">
            <DropdownMenu
              open={openDropdownUserId === member.userId}
              onOpenChange={(open) => {
                onDropdownOpenChange(open ? member.userId : null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("moreActionsAria")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {canRemove && (
                  <DropdownMenuItem
                    className="text-orange-500 focus:text-orange-600"
                    onSelect={(event) => {
                      event.preventDefault();
                      onDeactivate(member);
                    }}
                  >
                    {t("deactivateOption")}
                  </DropdownMenuItem>
                )}
                {canActivateMember && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onActivate(member);
                    }}
                  >
                    {t("activateOption")}
                  </DropdownMenuItem>
                )}
                {canEraseMember && (
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-600"
                    onSelect={(event) => {
                      event.preventDefault();
                      onErase(member);
                    }}
                  >
                    {t("deleteOption")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}
