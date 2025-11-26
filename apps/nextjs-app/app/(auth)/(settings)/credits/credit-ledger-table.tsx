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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/apps/nextjs-app/components/ui/pagination";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils";
import {
  getCreditLedger,
  type CreditLedgerEntry,
  type CreditLedgerResponse,
} from "@/apps/nextjs-app/lib/data";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

interface CreditLedgerTableProps {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  initialData: CreditLedgerResponse;
}

// Format the reason into a human-readable string
function formatReason(reason: string | null): string {
  if (!reason) return "—";

  // Normalize the reason string for matching
  const normalizedReason = reason.toLowerCase();

  // Check for patterns and return simplified labels
  if (normalizedReason.includes("transfer")) {
    return "Transfer";
  }
  if (
    normalizedReason.includes("purchase") ||
    normalizedReason.includes("stripe")
  ) {
    return "Purchase";
  }
  if (
    normalizedReason.includes("grant") &&
    normalizedReason.includes("removed")
  ) {
    return "Grant removed";
  }
  if (normalizedReason.includes("grant")) {
    return "Grant";
  }
  if (
    normalizedReason.includes("consume") ||
    normalizedReason.includes("study_consumed")
  ) {
    return "Study";
  }
  if (normalizedReason.includes("refund")) {
    return "Refund";
  }
  if (normalizedReason.includes("adjustment")) {
    return "Adjustment";
  }
  if (normalizedReason.includes("migration")) {
    return "Migration";
  }

  // Fallback: capitalize first letter, replace underscores with spaces
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

export function CreditLedgerTable({
  userId,
  companyId,
  isCompanyAdmin,
  teamIds,
  initialData,
}: CreditLedgerTableProps) {
  const [data, setData] = useState<CreditLedgerResponse>(initialData);
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
        | "delta"
        | "teamName"
        | "reason"
        | "byUserName") || "createdAt";
    const sortOrder = sortColumn?.desc ? "desc" : "asc";

    startTransition(async () => {
      try {
        const result = await getCreditLedger({
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
        console.error("Failed to fetch credit ledger:", error);
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
    // Skip initial fetch since we have initialData
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    fetchData();
  }, [fetchData]);

  const columns = useMemo<ColumnDef<CreditLedgerEntry>[]>(
    () => [
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
        cell: ({ row }) => {
          const entry = row.original;
          return <span className="block truncate">{entry.teamName}</span>;
        },
      },
      {
        id: "delta",
        header: "Credits",
        accessorKey: "delta",
        size: 80,
        cell: ({ row }) => {
          const delta = row.original.delta;
          const isPositive = delta > 0;
          return (
            <span
              className={cn(
                "font-medium",
                isPositive ? "text-green-600" : "text-red-600",
              )}
            >
              {isPositive ? "+" : ""}
              {delta}
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

          // Add study info if available
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
                    {entry.studyType &&
                      ` (${formatStudyType(entry.studyType)})`}
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
    ],
    [],
  );

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

  // Generate page numbers to show (show up to 5 pages around current page)
  const getVisiblePageNumbers = () => {
    const currentPage = pagination.pageIndex;
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(pageCount, start + maxVisible);

    // Adjust start if we're near the end
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    for (let i = start; i < end; i++) {
      pages.push(i);
    }

    return pages;
  };

  if (data.entries.length === 0 && !isPending) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No credit activity to display.
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
              // Show skeleton rows while loading
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
                  No credit activity found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Pagination className="justify-start sm:justify-start">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!table.getCanPreviousPage() || isPending) return;
                  table.previousPage();
                }}
                aria-disabled={!table.getCanPreviousPage() || isPending}
                className={cn(
                  (!table.getCanPreviousPage() || isPending) &&
                    "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
            {getVisiblePageNumbers().map((pageIndex) => (
              <PaginationItem key={`page-${pageIndex}`}>
                <PaginationLink
                  href="#"
                  isActive={pagination.pageIndex === pageIndex}
                  onClick={(event) => {
                    event.preventDefault();
                    if (isPending) return;
                    setPagination((prev) => ({ ...prev, pageIndex }));
                  }}
                  className={cn(isPending && "pointer-events-none")}
                >
                  {pageIndex + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (!table.getCanNextPage() || isPending) return;
                  table.nextPage();
                }}
                aria-disabled={!table.getCanNextPage() || isPending}
                className={cn(
                  (!table.getCanNextPage() || isPending) &&
                    "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">
            {data.total} {data.total === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Per page:</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                setPagination({ pageIndex: 0, pageSize: Number(value) });
              }}
              disabled={isPending}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((size) => (
                  <SelectItem key={`page-size-${size}`} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
