"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addMembersToTeam } from "@/apps/nextjs-app/lib/db/data";
import type { Team, CompanyMember } from "./types";

interface AddMembersDialogProps {
  team: Team;
  companyMembers: CompanyMember[];
  canInvite: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMembersDialog({
  team,
  companyMembers,
  canInvite,
  open,
  onOpenChange,
}: AddMembersDialogProps) {
  const router = useRouter();
  const [inviteMembers, setInviteMembers] = useState<
    Record<string, "ADMIN" | "MEMBER">
  >({});
  const [invitePending, startInviteTransition] = useTransition();
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [searchValue, setSearchValue] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const availableMembers = useMemo(() => {
    const existingIds = new Set(
      (team.members || []).map((member) => member.userId),
    );
    return companyMembers.filter(
      (member) =>
        !existingIds.has(member.userId) && !inviteMembers[member.userId],
    );
  }, [team, companyMembers, inviteMembers]);

  const selectedMember = availableMembers.find(
    (member) => member.userId === selectedUserId,
  );

  const inviteButtonDisabled =
    team.isPersonal || availableMembers.length === 0 || !canInvite;

  const inviteButtonTitle = (() => {
    if (team.isPersonal) {
      return "Personal teams can't receive invitations";
    }
    if (!canInvite) {
      return "You need to be a team admin to invite members";
    }
    if (availableMembers.length === 0 && Object.keys(inviteMembers).length === 0) {
      return "All company members are already on this team";
    }
    return undefined;
  })();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setInviteMembers({});
      setAddingMember(false);
      setSelectedUserId(null);
      setSelectedRole("MEMBER");
      setSearchValue("");
      setListOpen(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.keys(inviteMembers).length) return;

    const membersToInvite = Object.entries(inviteMembers).map(
      ([userId, role]) => {
        const member = companyMembers.find((m) => m.userId === userId);
        return {
          userId,
          role,
          email: member?.user.email,
        };
      },
    );

    startInviteTransition(async () => {
      try {
        await addMembersToTeam(team.id, team.name, membersToInvite);
        handleOpenChange(false);
        router.refresh();
        toast.success("Members added successfully");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to add members";
        toast.error(message);
      }
    });
  };

  const handleAddMember = () => {
    if (!selectedUserId) return;
    setInviteMembers((prev) => ({
      ...prev,
      [selectedUserId]: selectedRole,
    }));
    setSelectedUserId(null);
    setSearchValue("");
    setSelectedRole("MEMBER");
    setAddingMember(false);
  };

  const handleRemoveMember = (userId: string) => {
    setInviteMembers((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={inviteButtonDisabled}
              >
                Add team members
              </Button>
            </DialogTrigger>
          </span>
        </TooltipTrigger>
        {inviteButtonDisabled && inviteButtonTitle && (
          <TooltipContent>
            <p>{inviteButtonTitle}</p>
          </TooltipContent>
        )}
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members to {team.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {Object.keys(inviteMembers).length > 0 && (
            <div className="mb-4 max-h-60 overflow-y-auto">
              {Object.entries(inviteMembers).map(([userId, role]) => {
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
          {(addingMember || Object.keys(inviteMembers).length === 0) &&
          availableMembers.length > 0 ? (
            <div className="mb-4 flex items-start gap-2">
              <div
                className="flex-1"
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null;
                  if (!e.currentTarget.contains(next)) {
                    setListOpen(false);
                  }
                }}
              >
                <Command className="rounded-md border">
                  <CommandInput
                    placeholder="Search company members..."
                    value={
                      selectedMember
                        ? selectedMember.user.name || selectedMember.user.email
                        : searchValue
                    }
                    onValueChange={(v) => {
                      setSearchValue(v);
                      setSelectedUserId(null);
                      setListOpen(true);
                    }}
                    onClick={() => setListOpen(true)}
                    hideIcon
                  />
                  <CommandList
                    className={
                      listOpen
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
                            .includes(searchValue.toLowerCase()),
                        )
                        .map((m) => (
                          <CommandItem
                            key={m.userId}
                            value={m.user.name || m.user.email}
                            onSelect={() => {
                              setSelectedUserId(m.userId);
                              setSearchValue(m.user.name || m.user.email);
                              setListOpen(false);
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
          ) : availableMembers.length > 0 &&
            Object.keys(inviteMembers).length > 0 ? (
            <div className="mb-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddingMember(true);
                  setSearchValue("");
                  setSelectedUserId(null);
                }}
              >
                Add another member
              </Button>
            </div>
          ) : availableMembers.length === 0 ? (
            <p className="mb-4 text-sm text-orange-500">
              There are no more company members to be added to this team.
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={
              invitePending || Object.keys(inviteMembers).length === 0
            }
          >
            Add members
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
