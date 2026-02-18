"use client";

import {
  useMemo,
  useState,
  useTransition,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { TablePagination } from "@/apps/nextjs-app/components/ui/table-pagination";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import {
  getBalanceLedger,
  type BalanceLedgerEntry,
  type BalanceLedgerResponse,
} from "@/apps/nextjs-app/lib/db/data";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

interface CreditLedgerTableProps {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  initialData: BalanceLedgerResponse;
}

// Format the reason into a human-readable string
function formatReason(reason: string | null): string {
  if (!reason) return "—";

  const normalizedReason = reason.toLowerCase();

  if (normalizedReason.includes("transfer")) return "Transfer";
  if (
    normalizedReason.includes("purchase") ||
    normalizedReason.includes("stripe")
  )
    return "Purchase";
  if (
    normalizedReason.includes("grant") &&
    normalizedReason.includes("removed")
  )
    return "Grant removed";
  if (normalizedReason.includes("grant")) return "Grant";
  if (
    normalizedReason.includes("consume") ||
    normalizedReason.includes("study_consumed")
  )
    return "Study";
  if (normalizedReason.includes("refund")) return "Refund";
  if (normalizedReason.includes("adjustment")) return "Adjustment";
  if (normalizedReason.includes("migration")) return "Migration";

  const formatted = reason.replace(/_/g, " ").trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
}

// Format the study type into a readable string
function formatStudyType(studyType: string | null): string {
  if (!studyType) return "";

  const typeMap: Record<string, string> = {
    HEURISTIC_EVALUATION: "Heuristic Evaluation",
    COGNITIVE_WALKTHROUGH: "Cognitive Walkthrough",
    PERSONA: "Persona",
  };

  return typeMap[studyType] || studyType;
}

// Column definitions moved outside component (stable reference)
const columns: ColumnDef<BalanceLedgerEntry>[] = [
  {
    id: "createdAt",
    header: "Date",
    accessorKey: "createdAt",
    size: 180,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return (
        <span className="whitespace-nowrap">
          {date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          <span className="text-muted-foreground ml-2 text-xs">
            {date.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </span>
      );
    },
  },
  {
    id: "teamName",
    header: "Team",
    accessorKey: "teamName",
    size: 120,
    cell: ({ row }) => (
      <span className="block truncate">{row.original.teamName}</span>
    ),
  },
  {
    id: "amountCents",
    header: "Amount",
    accessorKey: "amountCents",
    size: 100,
    cell: ({ row }) => {
      const amountCents = row.original.amountCents;
      const isPositive = amountCents > 0;
      const formatted = `$${(Math.abs(amountCents) / 100).toFixed(2)}`;
      return (
        <span
          className={cn(
            "font-medium",
            isPositive ? "text-green-600" : "text-red-600",
          )}
        >
          {isPositive ? "+" : "-"}
          {formatted}
        </span>
      );
    },
  },
  {
    id: "reason",
    header: "Reason",
    accessorKey: "reasonKey",
    size: 150,
    cell: ({ row }) => {
      const entry = row.original;
      const formattedReason = formatReason(entry.reason);

      if (entry.studyName || entry.studyType) {
        return (
          <div className="flex flex-col">
            <span>{formattedReason}</span>
            {entry.studyName && (
              <span
                className="text-muted-foreground truncate text-xs"
                title={entry.studyName}
              >
                {entry.studyName}
                {entry.studyType && ` (${formatStudyType(entry.studyType)})`}
              </span>
            )}
          </div>
        );
      }

      return <span>{formattedReason}</span>;
    },
  },
  {
    id: "byUserName",
    header: "By",
    accessorKey: "byUserEmail",
    size: 150,
    cell: ({ row }) => {
      const entry = row.original;
      if (!entry.byUserEmail) {
        return <span className="text-muted-foreground">System</span>;
      }
      return (
        <span className="block truncate" title={entry.byUserEmail}>
          {entry.byUserEmail}
        </span>
      );
    },
  },
];

// Helper function for pagination (moved outside component)
function getVisiblePageNumbers(
  currentPageIndex: number,
  totalPages: number,
): number[] {
  const pageCount = Math.max(totalPages, 1);
  const pages: number[] = [];
  const maxVisible = 5;

  let start = Math.max(0, currentPageIndex - Math.floor(maxVisible / 2));
  const end = Math.min(pageCount, start + maxVisible);

  if (end - start < maxVisible) {
    start = Math.max(0, end - maxVisible);
  }

  for (let i = start; i < end; i++) {
    pages.push(i);
  }

  return pages;
}

export function CreditLedgerTable({
  userId,
  companyId,
  isCompanyAdmin,
  teamIds,
  initialData,
}: CreditLedgerTableProps) {
  const [data, setData] = useState<BalanceLedgerResponse>(initialData);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: initialData.page - 1,
    pageSize: initialData.pageSize,
  });
  const [isPending, startTransition] = useTransition();
  const isInitialMountRef = useRef(true);

  // Fetch data when sorting or pagination changes
  const fetchData = useCallback(() => {
    const sortColumn = sorting[0];
    const sortBy =
      (sortColumn?.id as
        | "createdAt"
        | "amountCents"
        | "teamName"
        | "reason"
        | "byUserName") || "createdAt";
    const sortOrder = sortColumn?.desc ? "desc" : "asc";

    startTransition(async () => {
      try {
        const result = await getBalanceLedger({
          userId,
          companyId,
          isCompanyAdmin,
          teamIds,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          sortBy,
          sortOrder,
        });
        setData(result);
      } catch (error) {
        console.error("Failed to fetch balance ledger:", error);
      }
    });
  }, [
    userId,
    companyId,
    isCompanyAdmin,
    teamIds,
    sorting,
    pagination.pageIndex,
    pagination.pageSize,
  ]);

  // Fetch when sorting or pagination changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    fetchData();
  }, [fetchData]);

  const table = useReactTable({
    data: data.entries,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: data.totalPages,
    enableSortingRemoval: false,
  });

  const pageCount = Math.max(data.totalPages, 1);
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(pagination.pageIndex, pageCount),
    [pagination.pageIndex, pageCount],
  );

  if (data.entries.length === 0 && !isPending) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No activity to display.
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4">
      <div className="relative w-full max-w-full overflow-x-auto">
        {isPending && (
          <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          </div>
        )}
        <Table className="group w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className="overflow-hidden whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
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
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending && data.entries.length === 0 ? (
              Array.from({ length: pagination.pageSize }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={`skeleton-cell-${colIndex}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="overflow-hidden">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No activity found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={pageCount}
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        onPreviousPage={() => table.previousPage()}
        onNextPage={() => table.nextPage()}
        onPageChange={(pageIndex) =>
          setPagination((prev) => ({ ...prev, pageIndex }))
        }
        onPageSizeChange={(pageSize) =>
          setPagination({ pageIndex: 0, pageSize })
        }
        pageSizeLabel="Per page:"
        totalCount={data.total}
        totalLabel="entry"
        totalLabelPlural="entries"
        disabled={isPending}
        keyPrefix="credit-page"
      />
    </div>
  );
}
