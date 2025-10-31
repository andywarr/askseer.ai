"use client";

import {
  useMemo,
  useState,
  useTransition,
  useCallback,
  useEffect,
} from "react";
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
import { getInitials } from "@/apps/nextjs-app/lib/utils";
import { toast } from "sonner";
import {
  updateCompanyMemberRole,
  inviteCompanyMember,
  removeCompanyMember,
} from "@/apps/nextjs-app/lib/data";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreVertical } from "lucide-react";
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
import { cn } from "@/apps/nextjs-app/lib/utils";

interface Member {
  userId: string;
  role: string;
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

interface Props {
  companyId: string;
  members: Member[];
  canEdit: boolean;
  currentUserId: string;
}

const roles = ["OWNER", "ADMIN", "BILLING", "MEMBER", "VIEWER"];

export default function CompanyMembers({
  companyId,
  members,
  canEdit,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePending, startInviteTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [memberList, setMemberList] = useState<Member[]>(members);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    setMemberList(members);
  }, [members]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, memberList.length]);

  const currentUserRole = useMemo(() => {
    const me = memberList.find((m) => m.userId === currentUserId);
    return String(me?.role || "").toUpperCase();
  }, [memberList, currentUserId]);
  const isCurrentUserOwner = currentUserRole === "OWNER";

  const handleChange = useCallback(
    (userId: string, role: string) => {
      startTransition(async () => {
        try {
          await updateCompanyMemberRole(companyId, userId, role);
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
    [companyId, setMemberList, startTransition],
  );

  const handleInvite = () => {
    startInviteTransition(async () => {
      try {
        await inviteCompanyMember(
          companyId,
          inviteEmail,
          inviteRole,
          inviteMessage,
        );
        toast.success("Invite sent");
        setInviteOpen(false);
        setInviteEmail("");
        setInviteMessage("");
        setInviteRole("MEMBER");
      } catch (e: any) {
        toast.error(e?.message || "Failed to send invite");
      }
    });
  };

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
        id: "role",
        header: "Role",
        accessorKey: "role",
        cell: ({ row }) => {
          const m = row.original;
          return canEdit && m.userId !== currentUserId ? (
            <Select
              value={m.role}
              onValueChange={(value) => handleChange(m.userId, value)}
              disabled={pending}
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
            (member.role !== "OWNER" || isCurrentUserOwner);
          if (!canRemove) {
            return null;
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu>
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
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-600"
                    onSelect={(event) => {
                      event.preventDefault();
                      setRemoveTarget(member);
                    }}
                  >
                    Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [
      canEdit,
      currentUserId,
      handleChange,
      isCurrentUserOwner,
      pending,
    ],
  );

  const table = useReactTable({
    data: useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return memberList;
      return memberList.filter((m) => {
        const name = (m.user.name || "").toLowerCase();
        const email = (m.user.email || "").toLowerCase();
        const role = (m.role || "").toLowerCase();
        return name.includes(q) || email.includes(q) || role.includes(q);
      });
    }, [memberList, search]),
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
                  placeholder="Email"
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
                <Textarea
                  placeholder="Message (optional)"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="mb-4"
                />
                <Button
                  className="w-full"
                  onClick={handleInvite}
                  disabled={invitePending || !inviteEmail.trim()}
                >
                  Send Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                      <span>{flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}</span>
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
                  !table.getCanNextPage() &&
                    "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <div className="flex items-center gap-2 sm:justify-end sm:pl-4">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
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
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            if (removePending) {
              return;
            }
            setRemoveTarget(null);
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate member</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `This will deactivate ${
                    removeTarget.user.name || removeTarget.user.email
                  } from the company. Their past work will remain available.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!removeTarget) return;
                startRemoveTransition(async () => {
                  try {
                    await removeCompanyMember(companyId, removeTarget.userId);
                    setMemberList((prev) =>
                      prev.filter((member) => member.userId !== removeTarget.userId),
                    );
                    toast.success("Member deactivated");
                    setRemoveTarget(null);
                    router.refresh();
                  } catch (e: any) {
                    toast.error(e?.message || "Failed to deactivate member");
                  }
                });
              }}
              disabled={removePending}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
