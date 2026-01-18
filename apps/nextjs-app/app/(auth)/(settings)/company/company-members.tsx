"use client";

import {
  useMemo,
  useState,
  useTransition,
  useCallback,
  useEffect,
} from "react";
import type { Member, Team } from "./types";
import {
  DeactivateMemberDialog,
  ActivateMemberDialog,
  EraseMemberDialog,
} from "./member-dialogs";
import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/apps/nextjs-app/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";
import { toast } from "sonner";
import {
  updateCompanyMember,
  inviteCompanyMember,
  removeCompanyMember,
  activateCompanyMember,
  eraseUser,
} from "@/apps/nextjs-app/lib/db/data";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  MoreVertical,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/apps/nextjs-app/components/ui/pagination";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface Props {
  companyId: string;
  members: Member[];
  canEdit: boolean;
  currentUserId: string;
  teams?: Team[];
}

const roles = ["OWNER", "ADMIN", "BILLING", "MEMBER", "VIEWER"];

export default function CompanyMembers({
  companyId,
  members,
  canEdit,
  currentUserId,
  teams = [],
}: Props) {
  const router = useRouter();
  const [membershipPending, startMembershipTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [inviteTeamSearch, setInviteTeamSearch] = useState("");
  const [inviteTeamListOpen, setInviteTeamListOpen] = useState(false);
  const [invitePending, startInviteTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [activatePending, startActivateTransition] = useTransition();
  const [activateTarget, setActivateTarget] = useState<Member | null>(null);
  const [erasePending, startEraseTransition] = useTransition();
  const [eraseTarget, setEraseTarget] = useState<Member | null>(null);
  const [eraseConfirmation, setEraseConfirmation] = useState("");
  const [memberList, setMemberList] = useState<Member[]>(members);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setMemberList(members);
  }, [members]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, showActiveOnly, memberList.length]);

  const currentUserRole = useMemo(() => {
    const me = memberList.find((m) => m.userId === currentUserId);
    return String(me?.role || "").toUpperCase();
  }, [memberList, currentUserId]);
  const isCurrentUserOwner = currentUserRole === "OWNER";
  const isCurrentUserAdmin = currentUserRole === "ADMIN" || isCurrentUserOwner;

  const handleChange = useCallback(
    (userId: string, role: string) => {
      startMembershipTransition(async () => {
        try {
          await updateCompanyMember({
            companyId,
            userId,
            role,
            canCreatePersonas:
              memberList.find((member) => member.userId === userId)
                ?.canCreatePersonas ?? true,
          });
          setMemberList((prev) =>
            prev.map((member) =>
              member.userId === userId ? { ...member, role } : member,
            ),
          );
          toast.success("Membership updated");
        } catch (e: any) {
          toast.error(e?.message || "Failed to update membership");
        }
      });
    },
    [companyId, memberList, setMemberList, startMembershipTransition],
  );

  const handlePermissionChange = useCallback(
    (userId: string, canCreatePersonas: boolean) => {
      const target = memberList.find((member) => member.userId === userId);
      if (!target) return;
      startMembershipTransition(async () => {
        try {
          await updateCompanyMember({
            companyId,
            userId,
            role: target.role,
            canCreatePersonas,
          });
          setMemberList((prev) =>
            prev.map((member) =>
              member.userId === userId
                ? { ...member, canCreatePersonas }
                : member,
            ),
          );
          toast.success(
            canCreatePersonas
              ? "Persona creation enabled"
              : "Persona creation disabled",
          );
        } catch (e: any) {
          toast.error(e?.message || "Failed to update permissions");
        }
      });
    },
    [companyId, memberList, setMemberList, startMembershipTransition],
  );

  const allCanCreatePersonas = useMemo(
    () => memberList.length > 0 && memberList.every((m) => m.canCreatePersonas),
    [memberList],
  );
  const someCanCreatePersonas = useMemo(
    () => memberList.some((m) => m.canCreatePersonas),
    [memberList],
  );

  const handleToggleAllPermissions = useCallback(
    (canCreatePersonas: boolean) => {
      const targets = memberList.filter(
        (member) => member.canCreatePersonas !== canCreatePersonas,
      );
      if (!targets.length) return;
      startMembershipTransition(async () => {
        try {
          await Promise.all(
            targets.map((member) =>
              updateCompanyMember({
                companyId,
                userId: member.userId,
                role: member.role,
                canCreatePersonas,
              }),
            ),
          );
          setMemberList((prev) =>
            prev.map((member) => ({
              ...member,
              canCreatePersonas,
            })),
          );
          toast.success(
            canCreatePersonas
              ? "Persona creation enabled for all members"
              : "Persona creation disabled for all members",
          );
        } catch (e: any) {
          toast.error(e?.message || "Failed to update persona permissions");
        }
      });
    },
    [companyId, memberList, setMemberList, startMembershipTransition],
  );

  // Filter out personal teams for invite selection and sort alphabetically
  const selectableTeams = useMemo(
    () =>
      teams
        .filter((team) => !team.isPersonal)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  // Validate email format
  const isValidEmail = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(inviteEmail.trim());
  }, [inviteEmail]);

  const handleInvite = useCallback(() => {
    startInviteTransition(async () => {
      try {
        await inviteCompanyMember(
          companyId,
          inviteEmail,
          inviteRole,
          inviteMessage,
          inviteTeamIds,
        );
        toast.success("Invite sent");
        setInviteOpen(false);
        setInviteEmail("");
        setInviteMessage("");
        setInviteRole("MEMBER");
        setInviteTeamIds([]);
        setInviteTeamSearch("");
      } catch (e: any) {
        toast.error(e?.message || "Failed to send invite");
      }
    });
  }, [companyId, inviteEmail, inviteRole, inviteMessage, inviteTeamIds]);

  // Dialog callback handlers
  const handleCloseRemoveDialog = useCallback(() => {
    setRemoveTarget(null);
    setOpenDropdownUserId(null);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!removeTarget) return;
    const targetUserId = removeTarget.userId;
    startRemoveTransition(async () => {
      try {
        await removeCompanyMember(companyId, targetUserId);
        setMemberList((prev) =>
          prev.map((member) =>
            member.userId === targetUserId
              ? {
                  ...member,
                  status: "DEACTIVATED",
                  deactivatedAt: new Date().toISOString(),
                }
              : member,
          ),
        );
        toast.success("Member deactivated");
        setRemoveTarget(null);
        setOpenDropdownUserId(null);
      } catch (e: any) {
        toast.error(e?.message || "Failed to deactivate member");
      }
    });
  }, [companyId, removeTarget]);

  const handleCloseActivateDialog = useCallback(() => {
    setActivateTarget(null);
    setOpenDropdownUserId(null);
  }, []);

  const handleConfirmActivate = useCallback(() => {
    if (!activateTarget) return;
    const targetUserId = activateTarget.userId;
    startActivateTransition(async () => {
      try {
        await activateCompanyMember(companyId, targetUserId);
        setMemberList((prev) =>
          prev.map((member) =>
            member.userId === targetUserId
              ? {
                  ...member,
                  status: "ACTIVE",
                  deactivatedAt: null,
                }
              : member,
          ),
        );
        toast.success("Member activated");
        setActivateTarget(null);
        setOpenDropdownUserId(null);
      } catch (e: any) {
        toast.error(e?.message || "Failed to activate member");
      }
    });
  }, [companyId, activateTarget]);

  const handleCloseEraseDialog = useCallback(() => {
    setEraseTarget(null);
    setEraseConfirmation("");
    setOpenDropdownUserId(null);
  }, []);

  const handleConfirmErase = useCallback(() => {
    if (!eraseTarget) return;
    const targetUserId = eraseTarget.userId;
    startEraseTransition(async () => {
      try {
        await eraseUser(companyId, targetUserId);
        setMemberList((prev) =>
          prev.filter((member) => member.userId !== targetUserId),
        );
        toast.success("User deleted permanently");
        setEraseTarget(null);
        setEraseConfirmation("");
        setOpenDropdownUserId(null);
      } catch (e: any) {
        const message = e?.message || "Failed to delete user";
        if (e?.teams && e.teams.length > 0) {
          toast.error(
            `${message}\n\nTeams with studies: ${e.teams.map((t: any) => t.name).join(", ")}`,
            { duration: 6000 },
          );
        } else if (e?.companies && e.companies.length > 0) {
          toast.error(
            `${message}\n\nCompanies where sole owner: ${e.companies.map((c: any) => c.name).join(", ")}`,
            { duration: 6000 },
          );
        } else {
          toast.error(message);
        }
      }
    });
  }, [companyId, eraseTarget]);

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<Member>[]>(
    () => [
      {
        id: "name",
        header: "Name",
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
        header: "Email",
        accessorFn: (row) => row.user.email,
        cell: ({ row }) => row.original.user.email,
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const status = row.original.status || "ACTIVE";
          const display = status.charAt(0) + status.slice(1).toLowerCase();
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
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => {
          const m = row.original;
          const isDeactivated = m.status === "DEACTIVATED";
          return canEdit && m.userId !== currentUserId ? (
            <Select
              value={m.role}
              onValueChange={(value) => handleChange(m.userId, value)}
              disabled={membershipPending || isDeactivated}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="capitalize">{m.role.toLowerCase()}</span>
          );
        },
      },
      {
        id: "canCreatePersonas",
        header: () => (
          <div className="flex items-center gap-2">
            <Checkbox
              aria-label="Toggle persona creation for all members"
              checked={
                allCanCreatePersonas
                  ? true
                  : someCanCreatePersonas
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) =>
                handleToggleAllPermissions(Boolean(checked))
              }
              disabled={!canEdit || membershipPending}
            />
            <span>Create Personas</span>
          </div>
        ),
        cell: ({ row }) => {
          const m = row.original;
          const isDeactivated = m.status === "DEACTIVATED";
          return (
            <Checkbox
              aria-label={`Allow ${m.user.name || m.user.email} to create personas`}
              checked={m.canCreatePersonas}
              onCheckedChange={(checked) =>
                handlePermissionChange(m.userId, Boolean(checked))
              }
              disabled={!canEdit || membershipPending || isDeactivated}
            />
          );
        },
        enableSorting: false,
      },
      {
        id: "joinedAt",
        header: "Joined",
        accessorFn: (row) => new Date(row.joinedAt).getTime(),
        cell: ({ row }) => new Date(row.original.joinedAt).toLocaleDateString(),
      },
      {
        id: "lastAccessedAt",
        header: "Last Access",
        accessorFn: (row) =>
          row.user.lastAccessedAt
            ? new Date(row.user.lastAccessedAt).getTime()
            : undefined,
        cell: ({ row }) =>
          row.original.user.lastAccessedAt
            ? new Date(row.original.user.lastAccessedAt).toLocaleDateString()
            : "-",
        sortUndefined: 1, // place undefined at the end when sorting ascending
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const member = row.original;
          const canRemove =
            canEdit &&
            member.userId !== currentUserId &&
            (member.role !== "OWNER" || isCurrentUserOwner) &&
            member.status === "ACTIVE";
          const canActivate =
            canEdit &&
            member.userId !== currentUserId &&
            member.status === "DEACTIVATED";
          const canErase =
            isCurrentUserAdmin && member.userId !== currentUserId;
          if (!canRemove && !canActivate && !canErase) {
            return null;
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu
                open={openDropdownUserId === member.userId}
                onOpenChange={(open) => {
                  setOpenDropdownUserId(open ? member.userId : null);
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
                <DropdownMenuContent align="end" className="w-40">
                  {canRemove && (
                    <DropdownMenuItem
                      className="text-orange-500 focus:text-orange-600"
                      onSelect={(event) => {
                        event.preventDefault();
                        setRemoveTarget(member);
                      }}
                    >
                      Deactivate
                    </DropdownMenuItem>
                  )}
                  {canActivate && (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setActivateTarget(member);
                      }}
                    >
                      Activate
                    </DropdownMenuItem>
                  )}
                  {canErase && (
                    <DropdownMenuItem
                      className="text-red-500 focus:text-red-600"
                      onSelect={(event) => {
                        event.preventDefault();
                        setEraseTarget(member);
                        setEraseConfirmation("");
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [
      allCanCreatePersonas,
      canEdit,
      currentUserId,
      handleChange,
      handlePermissionChange,
      handleToggleAllPermissions,
      isCurrentUserOwner,
      isCurrentUserAdmin,
      membershipPending,
      someCanCreatePersonas,
      openDropdownUserId,
      setOpenDropdownUserId,
      setRemoveTarget,
      setActivateTarget,
      setEraseTarget,
    ],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const baseList = showActiveOnly
      ? memberList.filter((member) => member.status === "ACTIVE")
      : memberList;
    if (!q) return baseList;
    return baseList.filter((m) => {
      const name = (m.user.name || "").toLowerCase();
      const email = (m.user.email || "").toLowerCase();
      const role = (m.role || "").toLowerCase();
      const status = (m.status || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        status.includes(q)
      );
    });
  }, [memberList, search, showActiveOnly]);

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false, // toggle only asc/desc
  });
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Members
        </h3>
        {canEdit && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Invite</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
              </DialogHeader>
              <div>
                <Input
                  placeholder="What is the member's email?"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mb-4"
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v)}
                >
                  <SelectTrigger className="mb-4 h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectableTeams.length > 0 && (
                  <div className="mb-4">
                    <div
                      onFocus={() => setInviteTeamListOpen(true)}
                      onBlur={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (!e.currentTarget.contains(next)) {
                          setInviteTeamListOpen(false);
                        }
                      }}
                    >
                      <Command className="rounded-md border">
                        <CommandInput
                          placeholder="Add teams..."
                          value={inviteTeamSearch}
                          onValueChange={setInviteTeamSearch}
                          hideIcon={!inviteTeamListOpen}
                        />
                        <CommandList
                          className={
                            inviteTeamListOpen
                              ? "max-h-40 overflow-y-auto"
                              : "hidden max-h-40 overflow-y-auto"
                          }
                        >
                          <CommandEmpty>No teams found.</CommandEmpty>
                          <CommandGroup>
                            {selectableTeams
                              .filter((team) =>
                                team.name
                                  .toLowerCase()
                                  .includes(inviteTeamSearch.toLowerCase()),
                              )
                              .map((team) => {
                                const isSelected = inviteTeamIds.includes(
                                  team.id,
                                );
                                return (
                                  <CommandItem
                                    key={team.id}
                                    value={team.name}
                                    onSelect={() => {
                                      if (isSelected) {
                                        setInviteTeamIds((prev) =>
                                          prev.filter((id) => id !== team.id),
                                        );
                                      } else {
                                        setInviteTeamIds((prev) => [
                                          ...prev,
                                          team.id,
                                        ]);
                                      }
                                      setInviteTeamSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        isSelected
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {team.name}
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                    {inviteTeamIds.length > 0 && !inviteTeamListOpen && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {inviteTeamIds.map((teamId) => {
                          const team = selectableTeams.find(
                            (t) => t.id === teamId,
                          );
                          if (!team) return null;
                          return (
                            <Badge
                              key={teamId}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {team.name}
                              <button
                                type="button"
                                onClick={() =>
                                  setInviteTeamIds((prev) =>
                                    prev.filter((id) => id !== teamId),
                                  )
                                }
                                className="hover:text-destructive ml-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <Textarea
                  placeholder="Message (optional)"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="mb-4"
                />
                <Button
                  className="w-full"
                  onClick={handleInvite}
                  disabled={invitePending || !isValidEmail}
                >
                  Send Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Only show active members
          </span>
          <Switch
            checked={showActiveOnly}
            onCheckedChange={(checked) => setShowActiveOnly(Boolean(checked))}
            aria-label="Toggle to only show active members"
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isSorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        className="group hover:text-foreground/90 inline-flex items-center gap-1 text-left select-none"
                        onClick={() =>
                          header.column.toggleSorting(isSorted === "asc")
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {isSorted === false || !isSorted ? (
                          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        ) : isSorted === "asc" ? (
                          <ArrowUp className="ml-1 h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="ml-1 h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getVisibleFlatColumns().length}
                className="h-24 text-center"
              >
                There are no results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Pagination className="justify-start sm:justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!table.getCanPreviousPage()) return;
                  table.previousPage();
                }}
                aria-disabled={!table.getCanPreviousPage()}
                className={cn(
                  !table.getCanPreviousPage() &&
                    "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
            {Array.from({ length: pageCount }).map((_, index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  href="#"
                  isActive={table.getState().pagination.pageIndex === index}
                  onClick={(event) => {
                    event.preventDefault();
                    table.setPageIndex(index);
                  }}
                >
                  {index + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!table.getCanNextPage()) return;
                  table.nextPage();
                }}
                aria-disabled={!table.getCanNextPage()}
                className={cn(
                  !table.getCanNextPage() && "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <div className="flex items-center gap-2 sm:justify-end sm:pl-4">
          <span className="text-muted-foreground text-sm">
            Members per row:
          </span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) =>
              setPagination({ pageIndex: 0, pageSize: Number(value) })
            }
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DeactivateMemberDialog
        target={removeTarget}
        pending={removePending}
        onClose={handleCloseRemoveDialog}
        onConfirm={handleConfirmRemove}
      />
      <ActivateMemberDialog
        target={activateTarget}
        pending={activatePending}
        onClose={handleCloseActivateDialog}
        onConfirm={handleConfirmActivate}
      />
      <EraseMemberDialog
        target={eraseTarget}
        pending={erasePending}
        confirmation={eraseConfirmation}
        onConfirmationChange={setEraseConfirmation}
        onClose={handleCloseEraseDialog}
        onConfirm={handleConfirmErase}
      />
    </section>
  );
}
