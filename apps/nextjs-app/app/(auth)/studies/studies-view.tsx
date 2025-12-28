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
  Check,
  X,
  Star,
  Share2,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils";
import { getStudyTypeLabel } from "@/apps/nextjs-app/lib/study";
import { retryStudy, deleteS3Objects } from "@/apps/nextjs-app/lib/action";
import { deleteStudy } from "@/apps/nextjs-app/lib/data";

// Import StudyCard for grid view
import { StudyCard } from "@/apps/nextjs-app/components/study/study-card";
import { StarStudyButton } from "@/apps/nextjs-app/components/study/star-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";

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
  visibility?: "PRIVATE" | "TEAM" | "COMPANY";
  shareToken?: string | null;
  team?: { isPersonal?: boolean; company?: { id: string } | null } | null;
};

type StudyWithPreview = {
  study: StudySummary;
  previewUrl: string | null;
  canManage: boolean;
};

type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

interface StudiesViewProps {
  studies: StudyWithPreview[];
  currentUserId: string;
  teamMembers?: TeamMember[];
  starredStudyIds?: string[];
}

// Study types available for filtering (excluding UNKNOWN)
const STUDY_TYPE_OPTIONS = [
  { value: StudyType.COGNITIVE_WALKTHROUGH, label: "Walkthrough" },
  { value: StudyType.HEURISTIC_EVALUATION, label: "Evaluation" },
  { value: StudyType.PERSONA, label: "Persona" },
] as const;

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

export function StudiesView({
  studies,
  currentUserId,
  teamMembers = [],
  starredStudyIds = [],
}: StudiesViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<StudyType[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // Create a Set for O(1) starred lookup
  const starredIdsSet = useMemo(
    () => new Set(starredStudyIds),
    [starredStudyIds],
  );

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
        id: "star",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const { study } = row.original;
          return (
            <StarStudyButton
              studyId={study.id}
              userId={currentUserId}
              isStarred={starredIdsSet.has(study.id)}
            />
          );
        },
      },
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
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatUserName(row.original.study.createdByUser)}
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
        header: "Updated",
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
                  <div onClick={(e) => e.stopPropagation()}>
                    <ShareStudyButton
                      studyId={study.id}
                      visibility={study.visibility || "TEAM"}
                      shareToken={study.shareToken || null}
                      hasCompany={!!study.team?.company}
                      isPersonalTeam={study.team?.isPersonal}
                      variant="menuItem"
                    />
                  </div>
                )}
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
    [
      deletingIds,
      retryingIds,
      handleDelete,
      handleOpen,
      handleRetry,
      currentUserId,
      starredIdsSet,
    ],
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

  // Filter studies based on search query and selected filters
  const filteredStudies = useMemo(() => {
    return studies.filter(({ study }) => {
      // Filter by starred
      if (showStarredOnly && !starredIdsSet.has(study.id)) {
        return false;
      }

      // Filter by type
      if (selectedTypes.length > 0 && !selectedTypes.includes(study.type)) {
        return false;
      }

      // Filter by owner
      if (
        selectedOwnerIds.length > 0 &&
        !selectedOwnerIds.includes(study.createdByUserId)
      ) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = (study.name || "").toLowerCase();
        const type = getStudyTypeLabel(study.type).toLowerCase();
        const createdBy = formatUserName(study.createdByUser).toLowerCase();
        const modifiedBy = formatUserName(
          study.lastModifiedByUser || study.createdByUser,
        ).toLowerCase();
        if (
          !fuzzyMatch(name, query) &&
          !fuzzyMatch(type, query) &&
          !fuzzyMatch(createdBy, query) &&
          !fuzzyMatch(modifiedBy, query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    studies,
    searchQuery,
    selectedTypes,
    selectedOwnerIds,
    showStarredOnly,
    starredIdsSet,
  ]);

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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Starred Filter */}
        <Button
          variant={showStarredOnly ? "default" : "secondary"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            setShowStarredOnly(!showStarredOnly);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        >
          <Star className={cn("h-4 w-4", showStarredOnly && "fill-current")} />
          <span>Starred</span>
        </Button>

        {/* Type Filter */}
        <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8">
              <span>Type</span>
              {selectedTypes.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                  <div className="flex gap-1">
                    {selectedTypes.length <= 2 ? (
                      selectedTypes.map((type) => (
                        <Badge
                          key={type}
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {getStudyTypeLabel(type)}
                        </Badge>
                      ))
                    ) : (
                      <Badge
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {selectedTypes.length} selected
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {STUDY_TYPE_OPTIONS.map((option) => {
                    const isSelected = selectedTypes.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => {
                          setSelectedTypes((prev) =>
                            isSelected
                              ? prev.filter((t) => t !== option.value)
                              : [...prev, option.value],
                          );
                          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                        }}
                      >
                        <div
                          className={cn(
                            "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Owner Filter */}
        {teamMembers.length > 0 && (
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8">
                <span>Owner</span>
                {selectedOwnerIds.length > 0 && (
                  <>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                    <div className="flex gap-1">
                      {selectedOwnerIds.length <= 2 ? (
                        selectedOwnerIds.map((ownerId) => {
                          const member = teamMembers.find(
                            (m) => m.id === ownerId,
                          );
                          return (
                            <Badge
                              key={ownerId}
                              variant="secondary"
                              className="rounded-sm px-1 font-normal"
                            >
                              {member?.name || member?.email || "Unknown"}
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {selectedOwnerIds.length} selected
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search members..."
                  value={ownerSearchQuery}
                  onValueChange={setOwnerSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {teamMembers
                      .filter((member) => {
                        if (!ownerSearchQuery.trim()) return true;
                        const query = ownerSearchQuery.toLowerCase();
                        return (
                          (member.name?.toLowerCase() || "").includes(query) ||
                          (member.email?.toLowerCase() || "").includes(query)
                        );
                      })
                      .map((member) => {
                        const isSelected = selectedOwnerIds.includes(member.id);
                        return (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setSelectedOwnerIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== member.id)
                                  : [...prev, member.id],
                              );
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: 0,
                              }));
                            }}
                          >
                            <div
                              className={cn(
                                "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </div>
                            <Avatar className="mr-2 h-6 w-6">
                              {member.image ? (
                                <AvatarImage
                                  src={member.image}
                                  alt={member.name || member.email || "User"}
                                />
                              ) : null}
                              <AvatarFallback className="text-xs">
                                {getInitials(member.name || member.email || "")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {member.name || member.email || "Unknown"}
                              </span>
                              {member.name && member.email && (
                                <span className="text-muted-foreground text-xs">
                                  {member.email}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear Filters */}
        {(selectedTypes.length > 0 ||
          selectedOwnerIds.length > 0 ||
          showStarredOnly) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={() => {
              setSelectedTypes([]);
              setSelectedOwnerIds([]);
              setShowStarredOnly(false);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Sort Dropdown (Grid View) */}
        {view === "grid" && (
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8">
                  {sorting[0]?.desc ? (
                    <ArrowDown className="mr-2 h-4 w-4" />
                  ) : (
                    <ArrowUp className="mr-2 h-4 w-4" />
                  )}
                  {sorting[0]?.id === "name"
                    ? "Name"
                    : sorting[0]?.id === "createdByUser"
                      ? "Owner"
                      : sorting[0]?.id === "createdAt"
                        ? "Created"
                        : "Updated"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                  Sort by
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: "name", desc: prev[0]?.desc ?? false },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {sorting[0]?.id === "name" && <Check className="h-4 w-4" />}
                  </span>
                  Name
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: "createdByUser", desc: prev[0]?.desc ?? false },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {sorting[0]?.id === "createdByUser" && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  Owner
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: "createdAt", desc: prev[0]?.desc ?? true },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {sorting[0]?.id === "createdAt" && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  Created
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: "updatedAt", desc: prev[0]?.desc ?? true },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {sorting[0]?.id === "updatedAt" && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  Updated
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                  Sort direction
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: prev[0]?.id ?? "updatedAt", desc: false },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {!sorting[0]?.desc && <Check className="h-4 w-4" />}
                  </span>
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSorting((prev) => [
                      { id: prev[0]?.id ?? "updatedAt", desc: true },
                    ]);
                  }}
                >
                  <span className="w-6">
                    {sorting[0]?.desc && <Check className="h-4 w-4" />}
                  </span>
                  Descending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
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
              isStarred={starredIdsSet.has(study.id)}
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
