"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { toast } from "sonner";
import {
  getTeamJoinRequests,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/apps/nextjs-app/lib/db/data";
import { TablePaginationWithTable } from "@/apps/nextjs-app/components/ui/table-pagination";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";

// Local imports
import type { Team, TeamMember, CompanyMember, JoinRequest } from "./types";
import {
  createTeamColumns,
  createTeamMemberColumns,
} from "./team-table-columns";
import {
  useTeamPermissions,
  canRenameTeam,
  canInviteToTeam,
} from "./use-team-permissions";
import { CreateTeamDialog } from "./create-team-dialog";
import { AddMembersDialog } from "./add-members-dialog";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { TeamDetailsPanel } from "./team-details-panel";
import { TeamDangerZone } from "./team-danger-zone";
import TeamJoinRequests from "./team-join-requests";
import { useDebouncedValue } from "./use-debounced-value";

interface Props {
  companyId: string;
  teams: Team[];
  canEdit: boolean;
  currentUserId: string;
  members: CompanyMember[];
  disablePersonalTeams?: boolean;
}

export default function CompanyTeams({
  companyId,
  teams,
  canEdit,
  currentUserId,
  members: companyMembers,
  disablePersonalTeams = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("TeamsSettings");
  const locale = useLocale();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [memberSorting, setMemberSorting] = useState<SortingState>([]);
  const [teamPagination, setTeamPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [memberPagination, setMemberPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Search and filter state with debounce for performance
  const [searchInput, setSearchInput] = useState("");
  const [showPersonal, setShowPersonal] = useState(false);
  const [teamMemberSearchInput, setTeamMemberSearchInput] = useState("");

  // Debounced values - filtering only triggers after 300ms of no typing
  const search = useDebouncedValue(searchInput, 300);
  const teamMemberSearch = useDebouncedValue(teamMemberSearchInput, 300);

  // Selection and editing state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    const teamIdParam = searchParams.get("teamId");
    if (teamIdParam && teams.some((team) => team.id === teamIdParam)) {
      return teamIdParam;
    }
    return null;
  });

  // Rename state (for table inline edit)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamePending, startRenameTransition] = useTransition();

  // Join policy overrides for optimistic updates
  const [joinPolicyOverrides, setJoinPolicyOverrides] = useState<
    Record<string, TeamJoinPolicy>
  >({});

  // Member management state
  const [teamMembersList, setTeamMembersList] = useState<
    Record<string, TeamMember[]>
  >({});
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [openMemberDropdownUserId, setOpenMemberDropdownUserId] = useState<
    string | null
  >(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removePending, startRemoveTransition] = useTransition();
  const [memberRolePending, startMemberRoleTransition] = useTransition();

  // Dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const openInviteDialogOnSelectRef = useRef(false);

  // URL sync effect
  useEffect(() => {
    const teamIdParam = searchParams.get("teamId");
    if (teamIdParam && !teams.some((team) => team.id === teamIdParam)) {
      setSelectedTeamId(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("teamId");
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
      return;
    }

    setSelectedTeamId((prev) => {
      if (teamIdParam) {
        return prev === teamIdParam ? prev : teamIdParam;
      }
      return prev === null ? prev : null;
    });
  }, [pathname, router, searchParams, teams]);

  // Sync URL with selectedTeamId
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTeamIdParam = params.get("teamId");

    if (selectedTeamId && currentTeamIdParam !== selectedTeamId) {
      params.set("teamId", selectedTeamId);
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
    } else if (!selectedTeamId && currentTeamIdParam) {
      params.delete("teamId");
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
    }
  }, [selectedTeamId, pathname, router, searchParams]);

  // Fetch join requests when team is selected
  const fetchJoinRequests = useCallback(async () => {
    if (selectedTeamId) {
      try {
        const requests = await getTeamJoinRequests(selectedTeamId);
        setJoinRequests(requests || []);
      } catch (error) {
        console.error("Failed to fetch join requests:", error);
        setJoinRequests([]);
      }
    } else {
      setJoinRequests([]);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    fetchJoinRequests();
  }, [fetchJoinRequests, selectedTeamId]);

  // Sync teamMembersList with teams data
  useEffect(() => {
    const newTeamMembersList: Record<string, TeamMember[]> = {};
    teams.forEach((team) => {
      newTeamMembersList[team.id] = team.members;
    });
    setTeamMembersList(newTeamMembersList);
  }, [teams]);

  // Sync join policy overrides
  useEffect(() => {
    const teamPolicyMap = new Map(
      teams.map((team) => [team.id, team.joinPolicy] as const),
    );
    setJoinPolicyOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [teamId, policy] of Object.entries(prev)) {
        const serverPolicy = teamPolicyMap.get(teamId);
        if (serverPolicy === undefined || serverPolicy === policy) {
          delete next[teamId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [teams]);

  // Reset state when team changes
  useEffect(() => {
    setMemberSorting([]);
    setTeamMemberSearchInput("");
    setOpenMemberDropdownUserId(null);
    setRemoveTarget(null);
    setEditingTeamId(null);
  }, [selectedTeamId]);

  // Reset pagination when filters change
  useEffect(() => {
    setTeamPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, showPersonal]);

  useEffect(() => {
    setMemberPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [teamMemberSearch, selectedTeamId]);

  // Open invite dialog on selection if ref is set
  useEffect(() => {
    if (openInviteDialogOnSelectRef.current) {
      openInviteDialogOnSelectRef.current = false;
      setInviteDialogOpen(true);
    }
  }, [selectedTeamId]);

  // Derived data
  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = teams;
    if (!showPersonal) {
      filtered = filtered.filter((t) => !t.isPersonal);
    }
    if (!q) return filtered;
    return filtered.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, search, showPersonal]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const {
    currentTeamRole,
    canRename: canRenameSelectedTeam,
    canInvite: canInviteSelectedTeam,
    canUpdateJoinPolicy,
    canRemoveMembers: canRemoveMembersFromSelectedTeam,
    canChangeRoles: canChangeMemberRoles,
    canDelete: canDeleteSelectedTeam,
  } = useTeamPermissions(selectedTeam, currentUserId, canEdit);

  // Clear selection if team no longer in filtered list
  useEffect(() => {
    if (
      selectedTeamId &&
      !filteredTeams.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId(null);
    }
  }, [filteredTeams, selectedTeamId]);

  // Sync renameValue with selected team
  useEffect(() => {
    if (selectedTeam) {
      setRenameValue(selectedTeam.name);
    } else {
      setRenameValue("");
    }
  }, [selectedTeam]);

  const getTeamMembers = useCallback(
    (teamId: string): TeamMember[] => {
      return teamMembersList[teamId] || [];
    },
    [teamMembersList],
  );

  const teamMembersData = useMemo(() => {
    if (!selectedTeam) return [];
    const members = getTeamMembers(selectedTeam.id);
    const query = teamMemberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const name = member.user.name?.toLowerCase() ?? "";
      const email = member.user.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [selectedTeam, teamMemberSearch, getTeamMembers]);

  const getAvailableMembersForTeam = useCallback(
    (team: Team) => {
      const existingIds = new Set(
        (team.members || []).map((member) => member.userId),
      );
      return companyMembers.filter((member) => !existingIds.has(member.userId));
    },
    [companyMembers],
  );

  // Event handlers
  const handleSelectTeam = useCallback((teamId: string) => {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
  }, []);

  const handleRenameSave = useCallback(
    (team: Team) => {
      const trimmed = renameValue.trim();
      if (!trimmed || trimmed === team.name) {
        setEditingTeamId(null);
        return;
      }
      // Validation happens in team-details-panel
      setEditingTeamId(null);
    },
    [renameValue],
  );

  const handleRenameCancel = useCallback((team: Team) => {
    setRenameValue(team.name);
    setEditingTeamId(null);
  }, []);

  const handleMemberRoleChange = useCallback(
    (member: TeamMember, newRole: string) => {
      if (!selectedTeam) return;
      const currentRole = String(member.role).toUpperCase();
      const targetRole = newRole.toUpperCase();
      if (currentRole === targetRole) return;

      // Optimistic update
      setTeamMembersList((prev) => {
        const teamMembers = prev[selectedTeam.id] || [];
        return {
          ...prev,
          [selectedTeam.id]: teamMembers.map((m) =>
            m.userId === member.userId ? { ...m, role: targetRole } : m,
          ),
        };
      });

      startMemberRoleTransition(async () => {
        try {
          await updateTeamMemberRole(
            selectedTeam.id,
            member.userId,
            targetRole,
          );
          toast.success(t("memberRoleUpdated"));
          router.refresh();
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : t("failedToUpdateMemberRole");
          toast.error(message);
          // Revert optimistic update
          setTeamMembersList((prev) => {
            const teamMembers = prev[selectedTeam.id] || [];
            return {
              ...prev,
              [selectedTeam.id]: teamMembers.map((m) =>
                m.userId === member.userId ? { ...m, role: currentRole } : m,
              ),
            };
          });
        }
      });
    },
    [selectedTeam, router, t],
  );

  const handleRemoveMember = useCallback(() => {
    if (!removeTarget) return;
    const targetUserId = removeTarget.userId;
    const targetTeamId = removeTarget.teamId;

    // Store original members for potential revert
    const originalMembers = teamMembersList[targetTeamId] || [];

    // Optimistic update - immediately remove from UI
    setTeamMembersList((prev) => ({
      ...prev,
      [targetTeamId]: (prev[targetTeamId] || []).filter(
        (m) => m.userId !== targetUserId,
      ),
    }));
    setRemoveTarget(null);
    setOpenMemberDropdownUserId(null);

    startRemoveTransition(async () => {
      try {
        await removeTeamMember(targetTeamId, targetUserId);
        router.refresh();
        toast.success(t("memberRemoved"));
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("failedToRemoveMember");
        toast.error(message);
        // Revert optimistic update on error
        setTeamMembersList((prev) => ({
          ...prev,
          [targetTeamId]: originalMembers,
        }));
      }
    });
  }, [removeTarget, router, teamMembersList, t]);

  const handleJoinPolicyChange = useCallback(
    (policy: TeamJoinPolicy) => {
      setJoinPolicyOverrides((prev) => ({
        ...prev,
        [selectedTeamId!]: policy,
      }));
    },
    [selectedTeamId],
  );

  // Validation helpers
  const trimmedRenameValue = renameValue.trim();
  const renameIsValid =
    trimmedRenameValue.length >= 3 && trimmedRenameValue.length <= 50;
  const editingTeam = editingTeamId
    ? (teams.find((t) => t.id === editingTeamId) ?? null)
    : null;
  const renameHasChanged =
    !!editingTeam && trimmedRenameValue !== editingTeam.name;

  // Table columns
  const columns = useMemo(
    () =>
      createTeamColumns({
        t,
        locale,
        editingTeamId,
        renameValue,
        setRenameValue,
        renamePending,
        renameIsValid,
        renameHasChanged,
        handleRenameSave,
        handleRenameCancel,
        canRenameTeam: (team) => canRenameTeam(team, currentUserId, canEdit),
        canInviteToTeam: (team) =>
          canInviteToTeam(team, currentUserId, canEdit),
        getAvailableMembersForTeam,
        joinPolicyOverrides,
        selectedTeamId,
        setSelectedTeamId,
        setInviteDialogOpen,
        openInviteDialogOnSelectRef,
      }),
    [
      t,
      locale,
      editingTeamId,
      renameValue,
      renamePending,
      renameIsValid,
      renameHasChanged,
      handleRenameSave,
      handleRenameCancel,
      currentUserId,
      canEdit,
      getAvailableMembersForTeam,
      joinPolicyOverrides,
      selectedTeamId,
    ],
  );

  const teamMemberColumns = useMemo(
    () =>
      createTeamMemberColumns({
        t,
        locale,
        currentUserId,
        currentTeamRole,
        canEdit,
        canChangeMemberRoles,
        canRemoveMembersFromSelectedTeam,
        memberRolePending,
        openMemberDropdownUserId,
        setOpenMemberDropdownUserId,
        setRemoveTarget,
        handleMemberRoleChange,
      }),
    [
      t,
      locale,
      currentUserId,
      currentTeamRole,
      canEdit,
      canChangeMemberRoles,
      canRemoveMembersFromSelectedTeam,
      memberRolePending,
      openMemberDropdownUserId,
      handleMemberRoleChange,
    ],
  );

  // Tables
  const table = useReactTable({
    data: filteredTeams,
    columns,
    state: { sorting, pagination: teamPagination },
    onSortingChange: setSorting,
    onPaginationChange: setTeamPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
  });

  const teamMembersTable = useReactTable({
    data: teamMembersData,
    columns: teamMemberColumns,
    state: { sorting: memberSorting, pagination: memberPagination },
    onSortingChange: setMemberSorting,
    onPaginationChange: setMemberPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
    // Ensure proper row identity for optimistic updates
    getRowId: (row) => row.userId,
  });

  const teamPageCount = Math.max(table.getPageCount(), 1);
  const memberPageCount = Math.max(teamMembersTable.getPageCount(), 1);

  return (
    <section>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
          {t("teamsTitle")}
        </h2>
        {canEdit && (
          <CreateTeamDialog
            companyId={companyId}
            currentUserId={currentUserId}
            companyMembers={companyMembers}
          />
        )}
      </div>

      {/* Search and filters */}
      <div className="mb-4 flex items-center gap-4">
        <div className="w-full max-w-sm">
          <Input
            placeholder={t("searchTeamsPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {canEdit && !disablePersonalTeams && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
            <span className="text-muted-foreground">{t("showPersonalTeamsLabel")}</span>
            <Switch
              checked={showPersonal}
              onCheckedChange={(v) => setShowPersonal(Boolean(v))}
              aria-label={t("toggleShowingPersonalTeamsAria")}
            />
          </label>
        )}
      </div>

      {/* Teams table */}
      <Table className="group">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isSorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap"
                    style={
                      header.column.columnDef.size
                        ? { width: header.column.columnDef.size }
                        : undefined
                    }
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
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const isSelected = row.original.id === selectedTeamId;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "group/row cursor-pointer transition-colors",
                    isSelected && "bg-muted/50",
                  )}
                  onClick={() => handleSelectTeam(row.original.id)}
                  aria-selected={isSelected}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={
                        cell.column.columnDef.size
                          ? { width: cell.column.columnDef.size }
                          : undefined
                      }
                    >
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
                {t("noTeams")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Teams pagination */}
      <TablePaginationWithTable
        table={table}
        onPageSizeChange={(pageSize) =>
          setTeamPagination({ pageIndex: 0, pageSize })
        }
        pageSizeLabel={t("teamsPerPage")}
        keyPrefix="team-page"
      />

      <Separator className="my-8" />

      {/* Team details */}
      <div className="mt-8">
        {selectedTeam ? (
          <>
            <TeamDetailsPanel
              team={selectedTeam}
              currentUserId={currentUserId}
              canRename={canRenameSelectedTeam}
              canUpdateJoinPolicy={canUpdateJoinPolicy}
              joinPolicyOverride={joinPolicyOverrides[selectedTeam.id]}
              onJoinPolicyChange={handleJoinPolicyChange}
              onFetchJoinRequests={fetchJoinRequests}
            />

            {/* Team Members Section */}
            <div className="mt-6 mb-4 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  {t("membersTitle")}
                </h3>
                {(canEdit || canInviteSelectedTeam) && selectedTeam && (
                  <AddMembersDialog
                    team={selectedTeam}
                    companyMembers={companyMembers}
                    canInvite={canInviteSelectedTeam}
                    open={inviteDialogOpen}
                    onOpenChange={setInviteDialogOpen}
                  />
                )}
              </div>
              <div className="w-full max-w-sm">
                <Input
                  placeholder={t("searchMembersPlaceholder", { teamName: selectedTeam.name })}
                  value={teamMemberSearchInput}
                  onChange={(e) => setTeamMemberSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Join requests */}
            {joinRequests.length > 0 && (
              <TeamJoinRequests
                teamId={selectedTeam.id}
                teamName={selectedTeam.name}
                requests={joinRequests}
                currentUserId={currentUserId}
                onRequestProcessed={fetchJoinRequests}
              />
            )}

            {/* Team members table */}
            <Table className="group">
              <TableHeader>
                {teamMembersTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isSorted = header.column.getIsSorted();
                      const canSort = header.column.getCanSort();
                      return (
                        <TableHead
                          key={header.id}
                          className="whitespace-nowrap"
                          style={
                            header.column.columnDef.size
                              ? { width: header.column.columnDef.size }
                              : undefined
                          }
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
                {teamMembersTable.getRowModel().rows.length ? (
                  teamMembersTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={
                            cell.column.columnDef.size
                              ? { width: cell.column.columnDef.size }
                              : undefined
                          }
                        >
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
                      colSpan={teamMembersTable.getVisibleFlatColumns().length}
                      className="h-24 text-center"
                    >
                      {selectedTeam.members.length === 0
                        ? t("teamHasNoMembers")
                        : teamMemberSearch
                          ? t("noMembersMatchSearch")
                          : t("teamHasNoMembers")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Members pagination */}
            <TablePaginationWithTable
              table={teamMembersTable}
              onPageSizeChange={(pageSize) =>
                setMemberPagination({ pageIndex: 0, pageSize })
              }
              pageSizeLabel={t("membersPerPage")}
              keyPrefix="team-member-page"
            />

            {/* Danger zone */}
            {canDeleteSelectedTeam && (
              <TeamDangerZone
                team={selectedTeam}
                canDelete={canDeleteSelectedTeam}
                onDeleted={() => setSelectedTeamId(null)}
              />
            )}
          </>
        ) : (
          <p className="text-muted-foreground py-8 text-center">
            {t("noTeamSelected")}
          </p>
        )}
      </div>

      {/* Remove member dialog */}
      <RemoveMemberDialog
        removeTarget={removeTarget}
        removePending={removePending}
        onClose={() => {
          setRemoveTarget(null);
          setOpenMemberDropdownUserId(null);
        }}
        onConfirm={handleRemoveMember}
      />
    </section>
  );
}
