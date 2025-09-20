"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { toast } from "sonner";
import { createTeam } from "@/apps/nextjs-app/lib/data";
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
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "@/apps/shared/constants";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils";

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [showPersonal, setShowPersonal] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [memberRoles, setMemberRoles] = useState<Record<string, "ADMIN" | "MEMBER">>({});
  const [pending, startTransition] = useTransition();
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberSorting, setMemberSorting] = useState<SortingState>([]);

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
    if (selectedTeamId && !filteredTeams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(null);
    }
  }, [filteredTeams, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const teamMembersData = useMemo(
    () => selectedTeam?.members ?? [],
    [selectedTeam],
  );

  useEffect(() => {
    setMemberSorting([]);
  }, [selectedTeamId]);

  const availableMembers = companyMembers.filter(
    (m) => !memberRoles[m.userId],
  );
  const selectedMember = availableMembers.find(
    (m) => m.userId === selectedUserId,
  );

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
        cell: ({ row }) =>
          new Date(row.original.joinedAt).toLocaleDateString(),
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const teamMembersTable = useReactTable({
    data: teamMembersData,
    columns: teamMemberColumns,
    state: { sorting: memberSorting },
    onSortingChange: setMemberSorting,
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
                {addingMember ? (
                  <div className="mb-4 flex items-start gap-2">
                    <div
                      className="flex-1"
                      onFocus={() => setMemberListOpen(true)}
                      onBlur={(e) => {
                        const next = e.relatedTarget as Node | null;
                        if (!e.currentTarget.contains(next)) {
                          setMemberListOpen(false);
                        }
                      }}
                    >
                      <Command className="rounded-md border">
                        <CommandInput
                          placeholder="Select member..."
                          value={
                            selectedMember
                              ? selectedMember.user.name ||
                                selectedMember.user.email
                              : memberSearch
                          }
                          onValueChange={(v) => {
                            setMemberSearch(v);
                            setSelectedUserId(null);
                          }}
                          hideIcon
                        />
                        <CommandList
                          className={
                            memberListOpen
                              ? "max-h-40 overflow-y-auto"
                              : "hidden max-h-40 overflow-y-auto"
                          }
                        >
                          <CommandEmpty>No members found.</CommandEmpty>
                          <CommandGroup>
                            {availableMembers
                              .filter((m) =>
                                (m.user.name || m.user.email)
                                  .toLowerCase()
                                  .includes(memberSearch.toLowerCase()),
                              )
                              .map((m) => (
                                <CommandItem
                                  key={m.userId}
                                  value={m.user.name || m.user.email}
                                  onSelect={() => {
                                    setSelectedUserId(m.userId);
                                    setMemberSearch(
                                      m.user.name || m.user.email,
                                    );
                                    setMemberListOpen(false);
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
                      value={selectedRole}
                      onValueChange={(value) =>
                        setSelectedRole(value as "ADMIN" | "MEMBER")
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
                        if (!selectedUserId) return;
                        setMemberRoles((prev) => ({
                          ...prev,
                          [selectedUserId]: selectedRole,
                        }));
                        setSelectedUserId(null);
                        setMemberSearch("");
                        setSelectedRole("MEMBER");
                        setAddingMember(false);
                      }}
                      disabled={!selectedUserId}
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  availableMembers.length > 0 && (
                    <div className="mb-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingMember(true);
                          setMemberSearch("");
                          setSelectedUserId(null);
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
            table.getRowModel().rows.map((row) => {
              const isSelected = row.original.id === selectedTeamId;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isSelected && "bg-muted/50",
                  )}
                  onClick={() =>
                    setSelectedTeamId((prev) =>
                      prev === row.original.id ? null : row.original.id,
                    )
                  }
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
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            Team members
          </h4>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              disabled={!selectedTeam || selectedTeam.isPersonal}
              title={
                !selectedTeam
                  ? "Select a team to invite members"
                  : selectedTeam.isPersonal
                    ? "Personal teams can't receive invitations"
                    : undefined
              }
            >
              Invite team members
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            {teamMembersTable.getHeaderGroups().map((headerGroup) => (
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
                  {selectedTeam
                    ? "This team has no members."
                    : "No team is selected."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
