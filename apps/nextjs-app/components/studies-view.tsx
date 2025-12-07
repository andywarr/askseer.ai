"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  ChevronsUpDown,
  MoreVertical,
  LayoutGrid,
  List,
  ExternalLink,
  Trash2,
  RotateCcw,
  Loader2,
  XCircle,
} from "lucide-react";
import { StudyStatus, StudyType } from "@prisma/client";

// UI component imports
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/apps/nextjs-app/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/apps/nextjs-app/components/ui/pagination";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/apps/nextjs-app/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/study";
import { retryStudy, deleteS3Objects } from "@/apps/nextjs-app/lib/action";
import { deleteStudy } from "@/apps/nextjs-app/lib/data";

// Import StudyCard for grid view
import { StudyCard } from "@/apps/nextjs-app/components/study-card";

type StudyUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type StudyFile = {
  key?: string | null;
} | null;

type StudySummary = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdByUser?: StudyUser | null;
  lastModifiedByUser?: StudyUser | null;
  files?: (StudyFile | null)[] | null;
};

type StudyWithPreview = {
  study: StudySummary;
  previewUrl: string | null;
  canManage: boolean;
};

interface StudiesViewProps {
  studies: StudyWithPreview[];
  currentUserId: string;
}

function getStudyHref(type: StudyType, id: string): string | null {
  switch (type) {
    case StudyType.HEURISTIC_EVALUATION:
      return `/evaluation/${id}`;
    case StudyType.PERSONA:
      return `/persona/${id}`;
    case StudyType.COGNITIVE_WALKTHROUGH:
      return `/walkthrough/${id}`;
    default:
      return null;
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatUserName(user: StudyUser | null | undefined): string {
  if (!user) return "Unknown";
  return user.name || user.email || "Unknown";
}

export function StudiesView({ studies, currentUserId }: StudiesViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const handleRowClick = (study: StudySummary) => {
    if (study.status === StudyStatus.COMPLETED) {
      const href = getStudyHref(study.type, study.id);
      if (href) {
        router.push(href);
      }
    }
  };

  const handleOpen = (study: StudySummary) => {
    if (study.status === StudyStatus.COMPLETED) {
      const href = getStudyHref(study.type, study.id);
      if (href) {
        router.push(href);
      }
    }
  };

  const handleRetry = async (studyWithPreview: StudyWithPreview) => {
    const { study, canManage } = studyWithPreview;
    if (!canManage || retryingIds.has(study.id)) return;

    setRetryingIds((prev) => new Set(prev).add(study.id));
    try {
      const res = await retryStudy(study.id);
      if (res?.success) {
        router.refresh();
      }
    } catch (error) {
      console.error("Retry failed", error);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(study.id);
        return next;
      });
    }
  };

  const handleDelete = async (studyWithPreview: StudyWithPreview) => {
    const { study, canManage } = studyWithPreview;
    if (!canManage || deletingIds.has(study.id)) return;

    setDeletingIds((prev) => new Set(prev).add(study.id));
    try {
      await deleteStudy(study.id, currentUserId);

      // Delete S3 files if any
      const fileKeys =
        study.files
          ?.map((file) => file?.key)
          .filter((key): key is string => !!key) || [];
      if (fileKeys.length > 0) {
        await deleteS3Objects(fileKeys);
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to delete study:", error);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(study.id);
        return next;
      });
    }
  };

  const columns: ColumnDef<StudyWithPreview>[] = useMemo(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.study.name || "Untitled",
        header: "Name",
        cell: ({ row }) => {
          const { study } = row.original;
          const isPending = study.status === StudyStatus.PENDING;
          const isFailed = study.status === StudyStatus.FAILED;

          return (
            <div className="flex items-center gap-2">
              <span className="max-w-[300px] truncate font-medium">
                {study.name || "Untitled"}
              </span>
              {isPending && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  </TooltipTrigger>
                  <TooltipContent>Processing</TooltipContent>
                </Tooltip>
              )}
              {isFailed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </TooltipTrigger>
                  <TooltipContent>Failed</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        id: "type",
        accessorFn: (row) => row.study.type,
        header: "Type",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {getStudyTypeLabel(row.original.study.type)}
          </span>
        ),
      },
      {
        id: "createdByUser",
        accessorFn: (row) => formatUserName(row.study.createdByUser),
        header: "Created by",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatUserName(row.original.study.createdByUser)}
          </span>
        ),
      },
      {
        id: "lastModifiedByUser",
        accessorFn: (row) =>
          formatUserName(
            row.study.lastModifiedByUser || row.study.createdByUser,
          ),
        header: "Modified by",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatUserName(
              row.original.study.lastModifiedByUser ||
                row.original.study.createdByUser,
            )}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (row) =>
          row.study.createdAt ? new Date(row.study.createdAt).getTime() : 0,
        header: "Created",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatDate(row.original.study.createdAt)}
          </span>
        ),
      },
      {
        id: "updatedAt",
        accessorFn: (row) =>
          row.study.updatedAt ? new Date(row.study.updatedAt).getTime() : 0,
        header: "Last modified",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatDate(row.original.study.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const studyWithPreview = row.original;
          const { study, canManage } = studyWithPreview;
          const isCompleted = study.status === StudyStatus.COMPLETED;
          const isFailed = study.status === StudyStatus.FAILED;
          const isDeleting = deletingIds.has(study.id);
          const isRetrying = retryingIds.has(study.id);

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
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
                {isCompleted && (
                  <DropdownMenuItem onClick={() => handleOpen(study)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                )}
                {isFailed && canManage && (
                  <DropdownMenuItem
                    onClick={() => handleRetry(studyWithPreview)}
                    disabled={isRetrying}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry
                  </DropdownMenuItem>
                )}
                {canManage && (
                  <DropdownMenuItem
                    onClick={() => handleDelete(studyWithPreview)}
                    disabled={isDeleting}
                    className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [deletingIds, retryingIds],
  );

  const table = useReactTable({
    data: studies,
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

  // Sort studies for grid view
  const sortedStudiesForGrid = useMemo(() => {
    if (sorting.length === 0) return studies;
    const [sort] = sorting;
    const sorted = [...studies].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      switch (sort.id) {
        case "name":
          aVal = a.study.name || "";
          bVal = b.study.name || "";
          break;
        case "type":
          aVal = a.study.type;
          bVal = b.study.type;
          break;
        case "createdByUser":
          aVal = formatUserName(a.study.createdByUser);
          bVal = formatUserName(b.study.createdByUser);
          break;
        case "lastModifiedByUser":
          aVal = formatUserName(
            a.study.lastModifiedByUser || a.study.createdByUser,
          );
          bVal = formatUserName(
            b.study.lastModifiedByUser || b.study.createdByUser,
          );
          break;
        case "createdAt":
          aVal = a.study.createdAt ? new Date(a.study.createdAt).getTime() : 0;
          bVal = b.study.createdAt ? new Date(b.study.createdAt).getTime() : 0;
          break;
        case "updatedAt":
          aVal = a.study.updatedAt ? new Date(a.study.updatedAt).getTime() : 0;
          bVal = b.study.updatedAt ? new Date(b.study.updatedAt).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sort.desc ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [studies, sorting]);

  // Paginate for grid view
  const paginatedStudiesForGrid = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return sortedStudiesForGrid.slice(start, end);
  }, [sortedStudiesForGrid, pagination]);

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex justify-end">
        <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "list")}>
          <TabsList>
            <TabsTrigger value="grid" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
          }}
        >
          {paginatedStudiesForGrid.map(({ study, previewUrl, canManage }) => (
            <StudyCard
              key={study.id}
              study={study}
              currentUserId={currentUserId}
              previewUrl={previewUrl}
              canManage={canManage}
              imagePriority
            />
          ))}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
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
              table.getRowModel().rows.map((row) => {
                const { study } = row.original;
                const isClickable = study.status === StudyStatus.COMPLETED;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(isClickable && "cursor-pointer")}
                    onClick={() => handleRowClick(study)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="h-24 text-center"
                >
                  No studies found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {studies.length > pagination.pageSize && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-500">
            Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
            {Math.min(
              (pagination.pageIndex + 1) * pagination.pageSize,
              studies.length,
            )}{" "}
            of {studies.length} studies
          </div>
          <Pagination className="justify-end">
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
        </div>
      )}
    </div>
  );
}
