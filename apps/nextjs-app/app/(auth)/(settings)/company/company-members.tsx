"use client";

import {
  useMemo,
  useState,
  useTransition,
  useCallback,
  useEffect,
  useDeferredValue,
} from "react";
import type { Member, Team } from "./types";
import {
  DeactivateMemberDialog,
  ActivateMemberDialog,
  EraseMemberDialog,
} from "./member-dialogs";
import { InviteMemberDialog } from "./invite-member-dialog";
import { createMemberTableColumns } from "./member-table-columns";
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
import { toast } from "sonner";
import {
  updateCompanyMember,
  inviteCompanyMember,
  removeCompanyMember,
  activateCompanyMember,
  eraseUser,
} from "@/apps/nextjs-app/lib/db/data";
import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TablePaginationWithTable } from "@/apps/nextjs-app/components/ui/table-pagination";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";

interface Props {
  companyId: string;
  members: Member[];
  canEdit: boolean;
  currentUserId: string;
  teams?: Team[];
}

export default function CompanyMembers({
  companyId,
  members,
  canEdit,
  currentUserId,
  teams = [],
}: Props) {
  const [membershipPending, startMembershipTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [inviteOpen, setInviteOpen] = useState(false);
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
  }, [deferredSearch, showActiveOnly, memberList.length]);

  const currentUserRole = useMemo(() => {
    const me = memberList.find((m) => m.userId === currentUserId);
    return String(me?.role || "").toUpperCase();
  }, [memberList, currentUserId]);
  const isCurrentUserOwner = currentUserRole === "OWNER";
  const isCurrentUserAdmin = currentUserRole === "ADMIN" || isCurrentUserOwner;

  const handleRoleChange = useCallback(
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
        } catch (e: unknown) {
          const error = e as Error;
          toast.error(error?.message || "Failed to update membership");
        }
      });
    },
    [companyId, memberList],
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
        } catch (e: unknown) {
          const error = e as Error;
          toast.error(error?.message || "Failed to update permissions");
        }
      });
    },
    [companyId, memberList],
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
        } catch (e: unknown) {
          const error = e as Error;
          toast.error(error?.message || "Failed to update persona permissions");
        }
      });
    },
    [companyId, memberList],
  );

  // Invite handler
  const handleInvite = useCallback(
    (email: string, role: string, message: string, teamIds: string[]) => {
      startInviteTransition(async () => {
        try {
          await inviteCompanyMember(companyId, email, role, message, teamIds);
          toast.success("Invite sent");
          setInviteOpen(false);
        } catch (e: unknown) {
          const error = e as Error;
          toast.error(error?.message || "Failed to send invite");
        }
      });
    },
    [companyId],
  );

  // Dialog handlers
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
      } catch (e: unknown) {
        const error = e as Error;
        toast.error(error?.message || "Failed to deactivate member");
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
      } catch (e: unknown) {
        const error = e as Error;
        toast.error(error?.message || "Failed to activate member");
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
      } catch (e: unknown) {
        const error = e as { message?: string; teams?: { name: string }[]; companies?: { name: string }[] };
        const message = error?.message || "Failed to delete user";
        if (error?.teams && error.teams.length > 0) {
          toast.error(
            `${message}\n\nTeams with studies: ${error.teams.map((t) => t.name).join(", ")}`,
            { duration: 6000 },
          );
        } else if (error?.companies && error.companies.length > 0) {
          toast.error(
            `${message}\n\nCompanies where sole owner: ${error.companies.map((c) => c.name).join(", ")}`,
            { duration: 6000 },
          );
        } else {
          toast.error(message);
        }
      }
    });
  }, [companyId, eraseTarget]);

  // Create columns using the extracted function
  const columns = useMemo(
    () =>
      createMemberTableColumns({
        canEdit,
        currentUserId,
        isCurrentUserOwner,
        isCurrentUserAdmin,
        membershipPending,
        allCanCreatePersonas,
        someCanCreatePersonas,
        openDropdownUserId,
        onRoleChange: handleRoleChange,
        onPermissionChange: handlePermissionChange,
        onToggleAllPermissions: handleToggleAllPermissions,
        onDropdownOpenChange: setOpenDropdownUserId,
        onDeactivate: setRemoveTarget,
        onActivate: setActivateTarget,
        onErase: setEraseTarget,
      }),
    [
      canEdit,
      currentUserId,
      isCurrentUserOwner,
      isCurrentUserAdmin,
      membershipPending,
      allCanCreatePersonas,
      someCanCreatePersonas,
      openDropdownUserId,
      handleRoleChange,
      handlePermissionChange,
      handleToggleAllPermissions,
    ],
  );

  const filteredMembers = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
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
  }, [memberList, deferredSearch, showActiveOnly]);

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
  });
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Members
        </h3>
        {canEdit && (
          <InviteMemberDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            teams={teams}
            pending={invitePending}
            onInvite={handleInvite}
          />
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
      <TablePaginationWithTable
        table={table}
        onPageSizeChange={(pageSize) =>
          setPagination({ pageIndex: 0, pageSize })
        }
        pageSizeLabel="Members per page:"
        keyPrefix="member-page"
      />
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
