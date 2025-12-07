"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Search,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
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
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { Input } from "@/apps/nextjs-app/components/ui/input";
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

const STORAGE_KEY = "studies-view-preference";
const SORTING_STORAGE_KEY = "studies-sorting-preference";
const PAGE_SIZE_STORAGE_KEY = "studies-page-size-preference";

export function StudiesView({ studies, currentUserId }: StudiesViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Load view and sorting preferences from storage after hydration
  useEffect(() => {
    const storedView = localStorage.getItem(STORAGE_KEY);
    if (storedView === "grid" || storedView === "list") {
      setView(storedView);
    }

    const storedSorting = sessionStorage.getItem(SORTING_STORAGE_KEY);
    if (storedSorting) {
      try {
        const parsed = JSON.parse(storedSorting);
        if (Array.isArray(parsed)) {
          setSorting(parsed);
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    const storedPageSize = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (storedPageSize) {
      const pageSize = Number(storedPageSize);
      if ([5, 10, 20, 50].includes(pageSize)) {
        setPagination((prev) => ({ ...prev, pageSize }));
      }
    }

    setIsHydrated(true);
  }, []);

  // Persist view preference to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, view);
    }
  }, [view, isHydrated]);

  // Persist sorting preference to sessionStorage
  useEffect(() => {
    if (isHydrated) {
      sessionStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
    }
  }, [sorting, isHydrated]);

  // Persist page size preference to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pagination.pageSize));
    }
  }, [pagination.pageSize, isHydrated]);

  const handleRowClick = useCallback(
    (study: StudySummary) => {
      if (study.status === StudyStatus.COMPLETED) {
        const href = getStudyHref(study.type, study.id);
        if (href) {
          router.push(href);
        }
      }
    },
    [router],
  );

  const handleOpen = useCallback(
    (study: StudySummary) => {
      if (study.status === StudyStatus.COMPLETED) {
        const href = getStudyHref(study.type, study.id);
        if (href) {
          router.push(href);
        }
      }
    },
    [router],
  );

  const handleRetry = useCallback(
    async (studyWithPreview: StudyWithPreview) => {
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
    },
    [retryingIds, router],
  );

  const handleDelete = useCallback(
    async (studyWithPreview: StudyWithPreview) => {
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
    },
    [deletingIds, currentUserId, router],
  );

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
    [deletingIds, retryingIds, handleDelete, handleOpen, handleRetry],
  );

  // Simple fuzzy match function that handles plurals and partial matches
  const fuzzyMatch = (text: string, query: string): boolean => {
    // Direct substring match
    if (text.includes(query)) return true;

    // Handle plurals - remove trailing 's' from query and try again
    if (query.endsWith("s") && query.length > 1) {
      const singular = query.slice(0, -1);
      if (text.includes(singular)) return true;
    }

    // Handle plurals - add 's' to query and try again
    if (!query.endsWith("s")) {
      const plural = query + "s";
      if (text.includes(plural)) return true;
    }

    return false;
  };

  // Filter studies based on search query
  const filteredStudies = useMemo(() => {
    if (!searchQuery.trim()) return studies;
    const query = searchQuery.toLowerCase().trim();
    return studies.filter(({ study }) => {
      const name = (study.name || "").toLowerCase();
      const type = getStudyTypeLabel(study.type).toLowerCase();
      const createdBy = formatUserName(study.createdByUser).toLowerCase();
      const modifiedBy = formatUserName(
        study.lastModifiedByUser || study.createdByUser,
      ).toLowerCase();
      return (
        fuzzyMatch(name, query) ||
        fuzzyMatch(type, query) ||
        fuzzyMatch(createdBy, query) ||
        fuzzyMatch(modifiedBy, query)
      );
    });
  }, [studies, searchQuery]);

  const table = useReactTable({
    data: filteredStudies,
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
    if (sorting.length === 0) return filteredStudies;
    const [sort] = sorting;
    const sorted = [...filteredStudies].sort((a, b) => {
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
  }, [filteredStudies, sorting]);

  // Paginate for grid view
  const paginatedStudiesForGrid = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return sortedStudiesForGrid.slice(start, end);
  }, [sortedStudiesForGrid, pagination]);

  // Show nothing while loading preference to avoid flash
  if (!isHydrated) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Search and View Toggle */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search studies..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Reset to first page when searching
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="pl-9"
          />
        </div>
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

      {/* Pagination - only show for list view */}
      {view === "list" && filteredStudies.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {pageCount > 1 ? (
            <div className="text-muted-foreground text-sm">
              Showing {pagination.pageIndex * pagination.pageSize + 1} to{" "}
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                filteredStudies.length,
              )}{" "}
              of {filteredStudies.length} studies
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-4">
            {pageCount > 1 && (
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
                        isActive={
                          table.getState().pagination.pageIndex === index
                        }
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
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Studies per page:
              </span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => {
                  setPagination({ pageIndex: 0, pageSize: Number(value) });
                }}
              >
                <SelectTrigger className="h-8 w-20">
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
      )}
    </div>
  );
}
