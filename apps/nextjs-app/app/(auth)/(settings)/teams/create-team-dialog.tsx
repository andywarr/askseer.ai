"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
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
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "@/apps/shared/constants";
import { createTeam } from "@/apps/nextjs-app/lib/db/data";
import type { CompanyMember } from "./types";

interface CreateTeamDialogProps {
  companyId: string;
  currentUserId: string;
  companyMembers: CompanyMember[];
}

export function CreateTeamDialog({
  companyId,
  currentUserId,
  companyMembers,
}: CreateTeamDialogProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [memberRoles, setMemberRoles] = useState<
    Record<string, "ADMIN" | "MEMBER">
  >({});
  const [pending, startTransition] = useTransition();
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberListOpen, setMemberListOpen] = useState(false);

  const availableMembers = companyMembers.filter((m) => !memberRoles[m.userId]);
  const selectedMember = availableMembers.find(
    (m) => m.userId === selectedUserId,
  );

  const handleSubmit = (e: React.FormEvent) => {
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create team";
        toast.error(message);
      }
    });
  };

  const handleAddMember = () => {
    if (!selectedUserId) return;
    setMemberRoles((prev) => ({
      ...prev,
      [selectedUserId]: selectedRole,
    }));
    setSelectedUserId(null);
    setMemberSearch("");
    setSelectedRole("MEMBER");
    setAddingMember(false);
  };

  const handleRemoveMember = (userId: string) => {
    setMemberRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Team</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
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
                        onClick={() => handleRemoveMember(userId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {addingMember && availableMembers.length > 0 ? (
            <div className="mb-4 flex items-start gap-2">
              <div
                className="flex-1"
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null;
                  if (!e.currentTarget.contains(next)) {
                    setMemberListOpen(false);
                  }
                }}
              >
                <Command className="rounded-md border">
                  <CommandInput
                    placeholder="Search company members..."
                    value={
                      selectedMember
                        ? selectedMember.user.name ||
                          selectedMember.user.email
                        : memberSearch
                    }
                    onValueChange={(v) => {
                      setMemberSearch(v);
                      setSelectedUserId(null);
                      setMemberListOpen(true);
                    }}
                    onClick={() => setMemberListOpen(true)}
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
                size="icon"
                variant="secondary"
                className="self-start"
                onClick={handleAddMember}
                disabled={!selectedUserId}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : availableMembers.length > 0 ? (
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
                disabled={teamName.trim().length < TEAM_NAME_MIN_LENGTH}
              >
                {Object.keys(memberRoles).length > 0
                  ? "Add another member"
                  : "Add member"}
              </Button>
            </div>
          ) : null}
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
  );
}
