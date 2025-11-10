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
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
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
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  X,
  Check,
  Pencil,
} from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { toast } from "sonner";
import {
  createTeam,
  addMembersToTeam,
  updateTeamName,
  updateTeamDescription,
  updateTeamJoinPolicy,
  getTeamJoinRequests,
} from "@/apps/nextjs-app/lib/data";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/apps/nextjs-app/components/ui/radio-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/apps/nextjs-app/components/ui/pagination";
import {
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "@/apps/shared/constants";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import TeamJoinRequests from "@/apps/nextjs-app/components/team-join-requests";

const TEAM_JOIN_POLICY_OPTIONS: Array<{
  value: TeamJoinPolicy;
  label: string;
  description: string;
}> = [
  {
    value: "INVITE_ONLY",
    label: "Invite-only",
    description: "Only team admins can add company members to the team.",
  },
  {
    value: "SECRET",
    label: "Secret",
    description: "An invite-only team hidden from the Teams directory.",
  },
  {
    value: "REQUEST_TO_JOIN",
    label: "Request to join",
    description: "Company members can request to join the team.",
  },
  {
    value: "SELF_JOIN",
    label: "Join",
    description: "Any company member can join the team instantly.",
  },
];

const TEAM_JOIN_POLICY_LABELS = TEAM_JOIN_POLICY_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<TeamJoinPolicy, string>,
);

const TEAM_JOIN_POLICY_DESCRIPTIONS = TEAM_JOIN_POLICY_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.description }),
  {} as Record<TeamJoinPolicy, string>,
);

interface TeamMember {
  id: string;
  teamId: string;
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

interface Team {
  id: string;
  name: string;
  description?: string | null;
  joinPolicy: TeamJoinPolicy;
  isPersonal: boolean;
  credits: number;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

interface CompanyMember {
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
  teams: Team[];
  canEdit: boolean;
  currentUserId: string;
  members: CompanyMember[];
}

export default function CompanyTeams({
  companyId,
  teams,
  canEdit,
  currentUserId,
  members: companyMembers,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [showPersonal, setShowPersonal] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [memberRoles, setMemberRoles] = useState<
    Record<string, "ADMIN" | "MEMBER">
  >({});
  const [pending, startTransition] = useTransition();
  const [createAddingMember, setCreateAddingMember] = useState(false);
  const [createSelectedUserId, setCreateSelectedUserId] = useState<
    string | null
  >(null);
  const [createSelectedRole, setCreateSelectedRole] = useState<
    "ADMIN" | "MEMBER"
  >("MEMBER");
  const [createMemberSearch, setCreateMemberSearch] = useState("");
  const [createMemberListOpen, setCreateMemberListOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMembers, setInviteMembers] = useState<
    Record<string, "ADMIN" | "MEMBER">
  >({});
  const [invitePending, startInviteTransition] = useTransition();
  const [inviteAddingMember, setInviteAddingMember] = useState(false);
  const [inviteSelectedUserId, setInviteSelectedUserId] = useState<
    string | null
  >(null);
  const [inviteSelectedRole, setInviteSelectedRole] = useState<
    "ADMIN" | "MEMBER"
  >("MEMBER");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteMemberListOpen, setInviteMemberListOpen] = useState(false);
  const [joinPolicyPending, startJoinPolicyTransition] = useTransition();
  const [renamePending, startRenameTransition] = useTransition();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingHeaderTeamId, setEditingHeaderTeamId] = useState<string | null>(
    null,
  );
  const [editingDescriptionTeamId, setEditingDescriptionTeamId] = useState<
    string | null
  >(null);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [joinPolicyOverrides, setJoinPolicyOverrides] = useState<
    Record<string, TeamJoinPolicy>
  >({});
  const [memberSorting, setMemberSorting] = useState<SortingState>([]);
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [teamPagination, setTeamPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [memberPagination, setMemberPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const isEditingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const teamIdParam = searchParams.get("teamId");
    if (teamIdParam && !teams.some((team) => team.id === teamIdParam)) {
      setSelectedTeamId((prev) => (prev === null ? prev : null));
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

  const handleSelectTeam = useCallback((teamId: string) => {
    setSelectedTeamId((prev) => (prev === teamId ? null : teamId));
  }, []);

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

  // Function to fetch join requests
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

  // Fetch join requests when team is selected
  useEffect(() => {
    fetchJoinRequests();
  }, [fetchJoinRequests, selectedTeamId]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = teams;
    if (!showPersonal) {
      filtered = filtered.filter((t) => !t.isPersonal);
    }
    if (!q) return filtered;
    return filtered.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, search, showPersonal]);

  useEffect(() => {
    if (
      selectedTeamId &&
      !filteredTeams.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId(null);
    }
  }, [filteredTeams, selectedTeamId]);

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

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const selectedJoinPolicy = selectedTeam
    ? (joinPolicyOverrides[selectedTeam.id] ?? selectedTeam.joinPolicy)
    : null;

  const selectedJoinDescription = selectedJoinPolicy
    ? TEAM_JOIN_POLICY_DESCRIPTIONS[selectedJoinPolicy]
    : "";

  const teamMembersData = useMemo(() => {
    if (!selectedTeam) return [];
    const query = teamMemberSearch.trim().toLowerCase();
    if (!query) return selectedTeam.members;
    return selectedTeam.members.filter((member) => {
      const name = member.user.name?.toLowerCase() ?? "";
      const email = member.user.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [selectedTeam, teamMemberSearch]);

  useEffect(() => {
    setMemberSorting([]);
    setTeamMemberSearch("");
  }, [selectedTeamId]);

  useEffect(() => {
    setTeamPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search, showPersonal, filteredTeams.length]);

  useEffect(() => {
    setMemberPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [teamMemberSearch, selectedTeamId, teamMembersData.length]);

  useEffect(() => {
    setInviteDialogOpen(false);
    setInviteMembers({});
    setInviteAddingMember(false);
    setInviteSelectedUserId(null);
    setInviteSelectedRole("MEMBER");
    setInviteSearch("");
    setInviteMemberListOpen(false);
  }, [selectedTeamId]);

  // Sync renameValue with selected team's name when team changes or when name updates
  useEffect(() => {
    if (selectedTeam) {
      setRenameValue(selectedTeam.name);
      setDescriptionValue(selectedTeam.description || "");
    } else {
      setRenameValue("");
      setDescriptionValue("");
      setEditingTeamId(null);
    }
  }, [selectedTeam]); // Watch selectedTeam for updates

  // Reset editing state when switching teams
  useEffect(() => {
    setEditingTeamId(null);
    setEditingHeaderTeamId(null);
    setEditingDescriptionTeamId(null);
    isEditingRef.current = false;
  }, [selectedTeamId]);

  // Focus the input when editing the header team name starts
  useEffect(() => {
    if (editingHeaderTeamId === selectedTeam?.id && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingHeaderTeamId, selectedTeam?.id]);

  // Focus the input when editing the description starts
  useEffect(() => {
    if (
      editingDescriptionTeamId === selectedTeam?.id &&
      descriptionInputRef.current
    ) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [editingDescriptionTeamId, selectedTeam?.id]);

  const editingTeam = useMemo(() => {
    if (!editingTeamId) return null;
    return teams.find((team) => team.id === editingTeamId) ?? null;
  }, [editingTeamId, teams]);

  const createAvailableMembers = useMemo(
    () => companyMembers.filter((m) => !memberRoles[m.userId]),
    [companyMembers, memberRoles],
  );
  const createSelectedMember = createAvailableMembers.find(
    (m) => m.userId === createSelectedUserId,
  );

  const inviteAvailableMembers = useMemo(() => {
    if (!selectedTeam) return [];
    const existingIds = new Set(
      (selectedTeam.members || []).map((member) => member.userId),
    );
    return companyMembers.filter(
      (member) =>
        !existingIds.has(member.userId) && !inviteMembers[member.userId],
    );
  }, [selectedTeam, companyMembers, inviteMembers]);

  const inviteSelectedMember = inviteAvailableMembers.find(
    (member) => member.userId === inviteSelectedUserId,
  );

  const canRenameTeam = useCallback(
    (team: Team) => {
      if (canEdit) return true;
      const membership = team.members.find(
        (member) => member.userId === currentUserId,
      );
      const role = String(membership?.role || "").toUpperCase();
      return role === "OWNER" || role === "ADMIN";
    },
    [canEdit, currentUserId],
  );

  const canInviteSelectedTeam = useMemo(() => {
    if (!selectedTeam || selectedTeam.isPersonal) return false;
    if (canEdit) return true;
    const membership = selectedTeam.members.find(
      (member) => member.userId === currentUserId,
    );
    const role = String(membership?.role || "").toUpperCase();
    return role === "OWNER" || role === "ADMIN";
  }, [selectedTeam, canEdit, currentUserId]);

  const canUpdateJoinPolicy = useMemo(() => {
    if (!selectedTeam || selectedTeam.isPersonal) return false;
    if (canEdit) return true;
    const membership = selectedTeam.members.find(
      (member) => member.userId === currentUserId,
    );
    const role = String(membership?.role || "").toUpperCase();
    return role === "OWNER" || role === "ADMIN";
  }, [selectedTeam, canEdit, currentUserId]);

  const canRenameSelectedTeam = useMemo(
    () => (selectedTeam ? canRenameTeam(selectedTeam) : false),
    [selectedTeam, canRenameTeam],
  );

  const canShowInviteButton = canEdit || canInviteSelectedTeam;
  const inviteButtonTitle = (() => {
    if (!selectedTeam) {
      return "Select a team to invite members";
    }
    if (selectedTeam.isPersonal) {
      return "Personal teams can't receive invitations";
    }
    if (!canInviteSelectedTeam) {
      return "You need to be a team admin to invite members";
    }
    if (inviteAvailableMembers.length === 0) {
      return "All company members are already on this team";
    }
    return undefined;
  })();
  const inviteButtonDisabled =
    !selectedTeam ||
    selectedTeam.isPersonal ||
    inviteAvailableMembers.length === 0 ||
    !canInviteSelectedTeam;

  const handleRenameSave = useCallback(
    (team?: Team | null) => {
      const targetTeam = team ?? editingTeam;
      if (!targetTeam) return;
      const trimmed = renameValue.trim();
      if (!trimmed) {
        toast.error("Team name cannot be empty");
        return;
      }
      if (
        trimmed.length < TEAM_NAME_MIN_LENGTH ||
        trimmed.length > TEAM_NAME_MAX_LENGTH
      ) {
        toast.error(
          `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`,
        );
        return;
      }
      if (trimmed === targetTeam.name) {
        setEditingTeamId(null);
        setRenameValue(targetTeam.name);
        return;
      }

      startRenameTransition(async () => {
        try {
          await updateTeamName(targetTeam.id, currentUserId, trimmed);
          toast.success("Team name updated");
          setEditingTeamId(null);
          setRenameValue(trimmed);
          router.refresh();
        } catch (err: any) {
          toast.error(err?.message || "Failed to update team name");
          setRenameValue(targetTeam.name);
        }
      });
    },
    [editingTeam, renameValue, startRenameTransition, currentUserId, router],
  );

  const handleRenameCancel = useCallback(
    (team?: Team | null) => {
      const targetTeam = team ?? editingTeam ?? selectedTeam;
      if (targetTeam) {
        setRenameValue(targetTeam.name);
      } else {
        setRenameValue("");
      }
      setEditingTeamId(null);
    },
    [editingTeam, selectedTeam],
  );

  const handleHeaderTeamSave = useCallback(
    async (teamId: string, newName: string) => {
      const trimmed = newName.trim();
      const team = teams.find((t) => t.id === teamId);

      if (!team) {
        setEditingHeaderTeamId(null);
        return;
      }

      if (!trimmed) {
        toast.error("Team name cannot be empty");
        return;
      }

      if (
        trimmed.length < TEAM_NAME_MIN_LENGTH ||
        trimmed.length > TEAM_NAME_MAX_LENGTH
      ) {
        toast.error(
          `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`,
        );
        return;
      }

      if (trimmed === team.name) {
        setEditingHeaderTeamId(null);
        return;
      }

      startRenameTransition(async () => {
        try {
          await updateTeamName(teamId, currentUserId, trimmed);
          toast.success("Team name updated");
          setEditingHeaderTeamId(null);
          setRenameValue(trimmed);
          router.refresh();
        } catch (err: any) {
          toast.error(err?.message || "Failed to update team name");
        }
      });
    },
    [teams, currentUserId, router, startRenameTransition],
  );

  const handleDescriptionSave = useCallback(
    async (teamId: string, newDescription: string) => {
      const trimmed = newDescription.trim() || null;
      const team = teams.find((t) => t.id === teamId);

      if (!team) {
        setEditingDescriptionTeamId(null);
        return;
      }

      const currentDescription = team.description?.trim() || null;

      if (trimmed === currentDescription) {
        setEditingDescriptionTeamId(null);
        return;
      }

      startRenameTransition(async () => {
        try {
          await updateTeamDescription(teamId, currentUserId, trimmed);
          toast.success("Team description updated");
          setEditingDescriptionTeamId(null);
          setDescriptionValue(trimmed || "");
          router.refresh();
        } catch (err: any) {
          toast.error(err?.message || "Failed to update team description");
          // Reset to original value on error
          setDescriptionValue(team.description || "");
          setEditingDescriptionTeamId(null);
        }
      });
    },
    [teams, currentUserId, router, startRenameTransition],
  );

  const handleJoinPolicyChange = useCallback(
    (team: Team, policy: TeamJoinPolicy) => {
      // Check if user can update this specific team's policy
      const canUpdate = (() => {
        if (team.isPersonal) return false;
        if (canEdit) return true;
        const membership = team.members.find(
          (member) => member.userId === currentUserId,
        );
        const role = String(membership?.role || "").toUpperCase();
        return role === "OWNER" || role === "ADMIN";
      })();

      if (!canUpdate) return;

      const previousPolicy = joinPolicyOverrides[team.id] ?? team.joinPolicy;
      if (policy === previousPolicy) {
        return;
      }

      startJoinPolicyTransition(async () => {
        try {
          await updateTeamJoinPolicy(team.id, currentUserId, policy);
          setJoinPolicyOverrides((prev) => ({
            ...prev,
            [team.id]: policy,
          }));
          toast.success("Team join settings updated");
          router.refresh();
        } catch (err: any) {
          toast.error(err?.message || "Failed to update join settings");
          setJoinPolicyOverrides((prev) => {
            const copy = { ...prev };
            if (previousPolicy === team.joinPolicy) {
              delete copy[team.id];
            } else {
              copy[team.id] = previousPolicy;
            }
            return copy;
          });
        }
      });
    },
    [
      canEdit,
      currentUserId,
      joinPolicyOverrides,
      router,
      startJoinPolicyTransition,
    ],
  );

  const trimmedRenameValue = renameValue.trim();
  const renameIsValid =
    trimmedRenameValue.length >= TEAM_NAME_MIN_LENGTH &&
    trimmedRenameValue.length <= TEAM_NAME_MAX_LENGTH;
  const renameHasChanged =
    !!editingTeam && trimmedRenameValue !== editingTeam.name;

  const columns = useMemo<ColumnDef<Team>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => {
          const team = row.original;
          const isEditing = editingTeamId === team.id;
          const canRename = canRenameTeam(team);

          if (isEditing) {
            return (
              <div
                className="flex items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={TEAM_NAME_MAX_LENGTH}
                  disabled={renamePending}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (!renamePending) {
                        handleRenameSave(team);
                      }
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      handleRenameCancel(team);
                    }
                  }}
                  aria-label="Edit team name"
                  className="h-8 max-w-xs"
                />
                <Button
                  className="group/save"
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRenameSave(team);
                  }}
                  disabled={
                    renamePending || !renameIsValid || !renameHasChanged
                  }
                  aria-label="Save team name"
                >
                  <Check className="h-4 w-4 group-hover/save:text-green-600" />
                </Button>
                <Button
                  className="group/close"
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRenameCancel(team);
                  }}
                  disabled={renamePending}
                  aria-label="Cancel team rename"
                >
                  <X className="h-4 w-4 group-hover/close:text-red-600" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <span className="truncate">{team.name}</span>
            </div>
          );
        },
      },
      {
        id: "isPersonal",
        header: "Personal",
        accessorKey: "isPersonal",
        cell: ({ row }) => (row.original.isPersonal ? "Yes" : "No"),
      },
      {
        id: "joinPolicy",
        header: "Join status",
        accessorKey: "joinPolicy",
        cell: ({ row }) => {
          const team = row.original;
          const policy = joinPolicyOverrides[team.id] ?? team.joinPolicy;

          if (team.isPersonal) {
            return "N/A";
          }

          return TEAM_JOIN_POLICY_LABELS[policy];
        },
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
    [
      canRenameTeam,
      editingTeamId,
      handleRenameCancel,
      handleRenameSave,
      joinPolicyOverrides,
      renameHasChanged,
      renameIsValid,
      renamePending,
      renameValue,
    ],
  );

  const teamMemberColumns = useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.user.name || row.user.email,
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {member.user.image ? (
                  <AvatarImage src={member.user.image} />
                ) : (
                  <AvatarFallback>
                    {getInitials(member.user.name || member.user.email)}
                  </AvatarFallback>
                )}
              </Avatar>
              <span>{member.user.name || member.user.email}</span>
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
        cell: ({ row }) => (
          <span className="capitalize">{row.original.role.toLowerCase()}</span>
        ),
      },
      {
        id: "joinedAt",
        header: "Joined",
        accessorFn: (row) => new Date(row.joinedAt).getTime(),
        cell: ({ row }) => new Date(row.original.joinedAt).toLocaleDateString(),
      },
      {
        id: "lastAccessedAt",
        header: "Last access",
        accessorFn: (row) =>
          row.user.lastAccessedAt
            ? new Date(row.user.lastAccessedAt).getTime()
            : undefined,
        cell: ({ row }) =>
          row.original.user.lastAccessedAt
            ? new Date(row.original.user.lastAccessedAt).toLocaleDateString()
            : "-",
        sortUndefined: 1,
      },
    ],
    [],
  );

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
  });

  const teamPageCount = Math.max(table.getPageCount(), 1);
  const memberPageCount = Math.max(teamMembersTable.getPageCount(), 1);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
          Teams
        </h2>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Create Team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = teamName.trim();
                  if (!name) return;
                  const membersToAdd = Object.entries(memberRoles).map(
                    ([userId, role]) => {
                      const email = companyMembers.find(
                        (mem) => mem.userId === userId,
                      )?.user.email;
                      return { userId, role, email };
                    },
                  );
                  startTransition(async () => {
                    try {
                      await createTeam(
                        companyId,
                        currentUserId,
                        name,
                        membersToAdd,
                      );
                      toast.success("Team created");
                      setDialogOpen(false);
                      setTeamName("");
                      setMemberRoles({});
                      router.refresh();
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to create team");
                    }
                  });
                }}
              >
                <Input
                  autoFocus
                  placeholder="Team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mb-4"
                  maxLength={TEAM_NAME_MAX_LENGTH}
                />
                {Object.keys(memberRoles).length > 0 && (
                  <div className="mb-4 max-h-60 overflow-y-auto">
                    {Object.entries(memberRoles).map(([userId, role]) => {
                      const m = companyMembers.find(
                        (mem) => mem.userId === userId,
                      );
                      if (!m) return null;
                      return (
                        <div
                          key={userId}
                          className="mb-2 flex items-center justify-between gap-2 last:mb-0"
                        >
                          <span className="text-sm">
                            {m.user.name || m.user.email}
                          </span>
                          <div className="flex items-center gap-2">
                            <Select
                              value={role}
                              onValueChange={(value) =>
                                setMemberRoles((prev) => ({
                                  ...prev,
                                  [userId]: value as "ADMIN" | "MEMBER",
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setMemberRoles((prev) => {
                                  const copy = { ...prev };
                                  delete copy[userId];
                                  return copy;
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {createAddingMember ? (
                  <div className="mb-4 flex items-start gap-2">
                    <div
                      className="flex-1"
                      onFocus={() => setCreateMemberListOpen(true)}
                      onBlur={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (!e.currentTarget.contains(next)) {
                          setCreateMemberListOpen(false);
                        }
                      }}
                    >
                      <Command className="rounded-md border">
                        <CommandInput
                          placeholder="Select member..."
                          value={
                            createSelectedMember
                              ? createSelectedMember.user.name ||
                                createSelectedMember.user.email
                              : createMemberSearch
                          }
                          onValueChange={(v) => {
                            setCreateMemberSearch(v);
                            setCreateSelectedUserId(null);
                          }}
                          hideIcon
                        />
                        <CommandList
                          className={
                            createMemberListOpen
                              ? "max-h-40 overflow-y-auto"
                              : "hidden max-h-40 overflow-y-auto"
                          }
                        >
                          <CommandEmpty>No members found.</CommandEmpty>
                          <CommandGroup>
                            {createAvailableMembers
                              .filter((m) =>
                                (m.user.name || m.user.email)
                                  .toLowerCase()
                                  .includes(createMemberSearch.toLowerCase()),
                              )
                              .map((m) => (
                                <CommandItem
                                  key={m.userId}
                                  value={m.user.name || m.user.email}
                                  onSelect={() => {
                                    setCreateSelectedUserId(m.userId);
                                    setCreateMemberSearch(
                                      m.user.name || m.user.email,
                                    );
                                    setCreateMemberListOpen(false);
                                  }}
                                >
                                  {m.user.name || m.user.email}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                    <Select
                      value={createSelectedRole}
                      onValueChange={(value) =>
                        setCreateSelectedRole(value as "ADMIN" | "MEMBER")
                      }
                    >
                      <SelectTrigger className="h-8 w-[120px] self-start">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        if (!createSelectedUserId) return;
                        setMemberRoles((prev) => ({
                          ...prev,
                          [createSelectedUserId]: createSelectedRole,
                        }));
                        setCreateSelectedUserId(null);
                        setCreateMemberSearch("");
                        setCreateSelectedRole("MEMBER");
                        setCreateAddingMember(false);
                      }}
                      disabled={!createSelectedUserId}
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  createAvailableMembers.length > 0 && (
                    <div className="mb-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCreateAddingMember(true);
                          setCreateMemberSearch("");
                          setCreateSelectedUserId(null);
                        }}
                      >
                        Add member
                      </Button>
                    </div>
                  )
                )}
                <Button
                  type="submit"
                  disabled={
                    pending || teamName.trim().length < TEAM_NAME_MIN_LENGTH
                  }
                >
                  Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="mb-4 flex items-center gap-4">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
            <span className="text-muted-foreground">Show personal teams</span>
            <Switch
              checked={showPersonal}
              onCheckedChange={(v) => setShowPersonal(Boolean(v))}
              aria-label="Toggle showing personal teams"
            />
          </label>
        )}
      </div>
      <Table className="group">
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
                There are no teams.
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
            {Array.from({ length: teamPageCount }).map((_, index) => (
              <PaginationItem key={`team-page-${index}`}>
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
        <div className="flex items-center gap-2 sm:justify-end sm:pl-4">
          <span className="text-muted-foreground text-sm">Teams per page:</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) =>
              setTeamPagination({ pageIndex: 0, pageSize: Number(value) })
            }
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={`team-page-size-${size}`} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator className="my-8" />
      <div className="mt-8">
        {selectedTeam ? (
          <>
            {/* Editable Team Name */}
            <div className="mb-2">
              <h2 className="inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
                {editingHeaderTeamId === selectedTeam.id ? (
                  <input
                    key={`edit-${selectedTeam.id}`}
                    ref={inputRef}
                    type="text"
                    defaultValue={selectedTeam.name}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!renamePending && inputRef.current) {
                          handleHeaderTeamSave(
                            selectedTeam.id,
                            inputRef.current.value,
                          );
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingHeaderTeamId(null);
                      }
                    }}
                    onBlur={(e) => {
                      e.stopPropagation();
                      // Delay blur handling to avoid conflicts
                      setTimeout(() => {
                        if (
                          inputRef.current &&
                          editingHeaderTeamId === selectedTeam.id
                        ) {
                          handleHeaderTeamSave(
                            selectedTeam.id,
                            inputRef.current.value,
                          );
                        }
                      }, 150);
                    }}
                    className="border-b-2 border-gray-300 focus:outline-hidden"
                    disabled={renamePending}
                  />
                ) : (
                  <span
                    onClick={(e) => {
                      if (canRenameSelectedTeam && !renamePending) {
                        setEditingHeaderTeamId(selectedTeam.id);
                      }
                    }}
                    className={cn(
                      canRenameSelectedTeam &&
                        !renamePending &&
                        "hover:text-muted-foreground cursor-pointer transition-colors",
                    )}
                  >
                    {renameValue}
                  </span>
                )}
              </h2>
            </div>
            {/* Editable Team Description */}
            <div className="mb-6">
              {editingDescriptionTeamId === selectedTeam.id ? (
                <input
                  key={`edit-desc-${selectedTeam.id}`}
                  ref={descriptionInputRef}
                  type="text"
                  defaultValue={descriptionValue}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!renamePending && descriptionInputRef.current) {
                        handleDescriptionSave(
                          selectedTeam.id,
                          descriptionInputRef.current.value,
                        );
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingDescriptionTeamId(null);
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    setTimeout(() => {
                      if (
                        descriptionInputRef.current &&
                        editingDescriptionTeamId === selectedTeam.id
                      ) {
                        handleDescriptionSave(
                          selectedTeam.id,
                          descriptionInputRef.current.value,
                        );
                      }
                    }, 150);
                  }}
                  className="text-muted-foreground w-full border-b border-gray-300 text-sm focus:outline-hidden"
                  placeholder="Add description"
                  disabled={renamePending}
                />
              ) : (
                <p
                  onClick={(e) => {
                    if (canRenameSelectedTeam && !renamePending) {
                      setEditingDescriptionTeamId(selectedTeam.id);
                    }
                  }}
                  className={cn(
                    "text-muted-foreground text-sm",
                    canRenameSelectedTeam &&
                      !renamePending &&
                      "hover:text-muted-foreground/70 cursor-pointer transition-colors",
                    !descriptionValue && "italic",
                  )}
                >
                  {descriptionValue || "Add description"}
                </p>
              )}
            </div>
            {/* Team Join Policy */}
            {!selectedTeam.isPersonal && (
              <div className="mb-6">
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  Team Join Policy
                </h3>
                <RadioGroup
                  value={selectedJoinPolicy ?? undefined}
                  onValueChange={(value) =>
                    handleJoinPolicyChange(
                      selectedTeam,
                      value as TeamJoinPolicy,
                    )
                  }
                  disabled={!canUpdateJoinPolicy || joinPolicyPending}
                  className="mt-4 gap-4"
                >
                  {TEAM_JOIN_POLICY_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-start space-x-3"
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={`join-policy-${option.value}`}
                        disabled={!canUpdateJoinPolicy || joinPolicyPending}
                      />
                      <label
                        htmlFor={`join-policy-${option.value}`}
                        className="flex flex-1 cursor-pointer flex-col"
                      >
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {option.description}
                        </span>
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  Members
                </h3>
                {canShowInviteButton && (
                  <Dialog
                    open={inviteDialogOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setInviteDialogOpen(false);
                        setInviteMembers({});
                        setInviteAddingMember(false);
                        setInviteSelectedUserId(null);
                        setInviteSelectedRole("MEMBER");
                        setInviteSearch("");
                        setInviteMemberListOpen(false);
                        return;
                      }
                      if (inviteButtonDisabled) {
                        return;
                      }
                      setInviteDialogOpen(true);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        disabled={inviteButtonDisabled}
                        title={inviteButtonTitle}
                      >
                        Invite team members
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite team members</DialogTitle>
                      </DialogHeader>
                      {selectedTeam ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (
                              !selectedTeam ||
                              !Object.keys(inviteMembers).length
                            )
                              return;
                            const membersToInvite = Object.entries(
                              inviteMembers,
                            ).map(([userId, role]) => {
                              const member = companyMembers.find(
                                (m) => m.userId === userId,
                              );
                              return {
                                userId,
                                role,
                                email: member?.user.email,
                              };
                            });
                            startInviteTransition(async () => {
                              try {
                                await addMembersToTeam(
                                  selectedTeam.id,
                                  selectedTeam.name,
                                  membersToInvite,
                                );
                                toast.success("Invitations sent");
                                setInviteDialogOpen(false);
                                setInviteMembers({});
                                setInviteAddingMember(false);
                                setInviteSelectedUserId(null);
                                setInviteSelectedRole("MEMBER");
                                setInviteSearch("");
                                setInviteMemberListOpen(false);
                                router.refresh();
                              } catch (err: any) {
                                toast.error(
                                  err?.message || "Failed to invite members",
                                );
                              }
                            });
                          }}
                        >
                          {Object.keys(inviteMembers).length > 0 && (
                            <div className="mb-4 max-h-60 overflow-y-auto">
                              {Object.entries(inviteMembers).map(
                                ([userId, role]) => {
                                  const member = companyMembers.find(
                                    (m) => m.userId === userId,
                                  );
                                  if (!member) return null;
                                  return (
                                    <div
                                      key={userId}
                                      className="mb-2 flex items-center justify-between gap-2 last:mb-0"
                                    >
                                      <span className="text-sm">
                                        {member.user.name || member.user.email}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={role}
                                          onValueChange={(value) =>
                                            setInviteMembers((prev) => ({
                                              ...prev,
                                              [userId]: value as
                                                | "ADMIN"
                                                | "MEMBER",
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8 w-[120px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="ADMIN">
                                              Admin
                                            </SelectItem>
                                            <SelectItem value="MEMBER">
                                              Member
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            setInviteMembers((prev) => {
                                              const copy = { ...prev };
                                              delete copy[userId];
                                              return copy;
                                            })
                                          }
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                          {inviteAddingMember ? (
                            <div className="mb-4 flex items-start gap-2">
                              <div
                                className="flex-1"
                                onFocus={() => setInviteMemberListOpen(true)}
                                onBlur={(e) => {
                                  const next = e.relatedTarget as Node | null;
                                  if (!e.currentTarget.contains(next)) {
                                    setInviteMemberListOpen(false);
                                  }
                                }}
                              >
                                <Command className="rounded-md border">
                                  <CommandInput
                                    placeholder="Select member..."
                                    value={
                                      inviteSelectedMember
                                        ? inviteSelectedMember.user.name ||
                                          inviteSelectedMember.user.email
                                        : inviteSearch
                                    }
                                    onValueChange={(v) => {
                                      setInviteSearch(v);
                                      setInviteSelectedUserId(null);
                                    }}
                                    hideIcon
                                  />
                                  <CommandList
                                    className={
                                      inviteMemberListOpen
                                        ? "max-h-40 overflow-y-auto"
                                        : "hidden max-h-40 overflow-y-auto"
                                    }
                                  >
                                    <CommandEmpty>
                                      No members found.
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {inviteAvailableMembers
                                        .filter((m) =>
                                          (m.user.name || m.user.email)
                                            .toLowerCase()
                                            .includes(
                                              inviteSearch.toLowerCase(),
                                            ),
                                        )
                                        .map((m) => (
                                          <CommandItem
                                            key={m.userId}
                                            value={m.user.name || m.user.email}
                                            onSelect={() => {
                                              setInviteSelectedUserId(m.userId);
                                              setInviteSearch(
                                                m.user.name || m.user.email,
                                              );
                                              setInviteMemberListOpen(false);
                                            }}
                                          >
                                            {m.user.name || m.user.email}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </div>
                              <Select
                                value={inviteSelectedRole}
                                onValueChange={(value) =>
                                  setInviteSelectedRole(
                                    value as "ADMIN" | "MEMBER",
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-[120px] self-start">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="MEMBER">Member</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="sm"
                                className="self-start"
                                onClick={() => {
                                  if (!inviteSelectedUserId) return;
                                  setInviteMembers((prev) => ({
                                    ...prev,
                                    [inviteSelectedUserId]: inviteSelectedRole,
                                  }));
                                  setInviteSelectedUserId(null);
                                  setInviteSearch("");
                                  setInviteSelectedRole("MEMBER");
                                  setInviteAddingMember(false);
                                }}
                                disabled={!inviteSelectedUserId}
                              >
                                Add
                              </Button>
                            </div>
                          ) : inviteAvailableMembers.length > 0 ? (
                            <div className="mb-4">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setInviteAddingMember(true);
                                  setInviteSearch("");
                                  setInviteSelectedUserId(null);
                                }}
                              >
                                Add member
                              </Button>
                            </div>
                          ) : (
                            <p className="text-muted-foreground mb-4 text-sm">
                              All company members are already on this team.
                            </p>
                          )}
                          <Button
                            type="submit"
                            disabled={
                              invitePending ||
                              Object.keys(inviteMembers).length === 0
                            }
                          >
                            Send invites
                          </Button>
                        </form>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Select a team to invite members.
                        </p>
                      )}
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="w-full max-w-sm">
                <Input
                  placeholder="Search members..."
                  value={teamMemberSearch}
                  onChange={(e) => setTeamMemberSearch(e.target.value)}
                />
              </div>
            </div>
            {selectedTeam && joinRequests.length > 0 && (
              <TeamJoinRequests
                teamId={selectedTeam.id}
                teamName={selectedTeam.name}
                requests={joinRequests}
                currentUserId={currentUserId}
                onRequestProcessed={fetchJoinRequests}
              />
            )}
            <Table className="group">
              <TableHeader>
                {teamMembersTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isSorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          className="whitespace-nowrap"
                        >
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
                {teamMembersTable.getRowModel().rows.length ? (
                  teamMembersTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
                        ? "This team has no members."
                        : teamMemberSearch
                          ? "No members match your search."
                          : "This team has no members."}
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
                        if (!teamMembersTable.getCanPreviousPage()) return;
                        teamMembersTable.previousPage();
                      }}
                      aria-disabled={!teamMembersTable.getCanPreviousPage()}
                      className={cn(
                        !teamMembersTable.getCanPreviousPage() &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                  {Array.from({ length: memberPageCount }).map((_, index) => (
                    <PaginationItem key={`team-member-page-${index}`}>
                      <PaginationLink
                        href="#"
                        isActive={
                          teamMembersTable.getState().pagination.pageIndex ===
                          index
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          teamMembersTable.setPageIndex(index);
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
                        if (!teamMembersTable.getCanNextPage()) return;
                        teamMembersTable.nextPage();
                      }}
                      aria-disabled={!teamMembersTable.getCanNextPage()}
                      className={cn(
                        !teamMembersTable.getCanNextPage() &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="flex items-center gap-2 sm:justify-end sm:pl-4">
                <span className="text-muted-foreground text-sm">
                  Members per page:
                </span>
                <Select
                  value={String(
                    teamMembersTable.getState().pagination.pageSize,
                  )}
                  onValueChange={(value) =>
                    setMemberPagination({
                      pageIndex: 0,
                      pageSize: Number(value),
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((size) => (
                      <SelectItem
                        key={`team-member-page-size-${size}`}
                        value={String(size)}
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground py-8 text-center">
            No team selected
          </p>
        )}
      </div>
    </section>
  );
}
