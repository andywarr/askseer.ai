"use client";

import { useMemo, useState, useTransition } from "react";
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
import { updateCompanyMemberRole } from "@/apps/nextjs-app/lib/data";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

interface Member {
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
  const [pending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");

  const handleChange = (userId: string, role: string) => {
    startTransition(async () => {
      try {
        await updateCompanyMemberRole(companyId, userId, role);
        toast.success("Membership updated");
      } catch (e: any) {
        toast.error(e?.message || "Failed to update membership");
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
              defaultValue={m.role}
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
    ],
    [canEdit, currentUserId, handleChange, pending],
  );

  const table = useReactTable({
    data: useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return members;
      return members.filter((m) => {
        const name = (m.user.name || "").toLowerCase();
        const email = (m.user.email || "").toLowerCase();
        const role = (m.role || "").toLowerCase();
        return name.includes(q) || email.includes(q) || role.includes(q);
      });
    }, [members, search]),
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false, // toggle only asc/desc
  });

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Members
        </h3>
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
                return (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : (
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
    </section>
  );
}
