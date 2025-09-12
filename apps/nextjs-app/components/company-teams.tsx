"use client";

import { useMemo, useState } from "react";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/apps/nextjs-app/components/ui/table";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  credits: number;
  createdAt: string;
  memberCount: number;
}

interface Props {
  teams: Team[];
}

export default function CompanyTeams({ teams }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [showPersonal, setShowPersonal] = useState(true);

  const columns = useMemo<ColumnDef<Team>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
      },
      {
        id: "isPersonal",
        header: "Personal",
        accessorKey: "isPersonal",
        cell: ({ row }) => (row.original.isPersonal ? "Yes" : "No"),
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
    ],
    [],
  );

  const table = useReactTable({
    data: useMemo(() => {
      const q = search.trim().toLowerCase();
      let filtered = teams;
      if (!showPersonal) {
        filtered = filtered.filter((t) => !t.isPersonal);
      }
      if (!q) return filtered;
      return filtered.filter((t) => t.name.toLowerCase().includes(q));
    }, [teams, search, showPersonal]),
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Teams
        </h3>
      </div>
      <div className="mb-4 flex items-center gap-4">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
          <span className="text-muted-foreground">Show personal teams</span>
          <Switch
            checked={showPersonal}
            onCheckedChange={(v) => setShowPersonal(Boolean(v))}
            aria-label="Toggle showing personal teams"
          />
        </label>
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
                There are no teams.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
