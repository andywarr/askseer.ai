"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Check, X } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import type { Team } from "./types";

const ROLES = ["OWNER", "ADMIN", "BILLING", "MEMBER", "VIEWER"];

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  pending: boolean;
  onInvite: (
    email: string,
    role: string,
    message: string,
    teamIds: string[],
  ) => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  teams,
  pending,
  onInvite,
}: InviteMemberDialogProps) {
  const t = useTranslations("CompanySettings");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [message, setMessage] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamListOpen, setTeamListOpen] = useState(false);

  // Filter out personal teams and sort alphabetically
  const selectableTeams = useMemo(
    () =>
      teams
        .filter((team) => !team.isPersonal)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  // Validate email format
  const isValidEmail = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, [email]);

  const handleSubmit = () => {
    onInvite(email, role, message, teamIds);
    // Reset form
    setEmail("");
    setRole("MEMBER");
    setMessage("");
    setTeamIds([]);
    setTeamSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">{t("inviteBtn")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteMemberTitle")}</DialogTitle>
        </DialogHeader>
        <div>
          <Input
            placeholder={t("memberEmailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4"
          />
          <Select value={role} onValueChange={(v) => setRole(v)}>
            <SelectTrigger className="mb-4 h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t("roles." + r.toLowerCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectableTeams.length > 0 && (
            <div className="mb-4">
              <div
                onFocus={() => setTeamListOpen(true)}
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null;
                  if (!e.currentTarget.contains(next)) {
                    setTeamListOpen(false);
                  }
                }}
              >
                <Command className="rounded-md border">
                  <CommandInput
                    placeholder={t("addTeamsPlaceholder")}
                    value={teamSearch}
                    onValueChange={setTeamSearch}
                    hideIcon={!teamListOpen}
                  />
                  <CommandList
                    className={
                      teamListOpen
                        ? "max-h-40 overflow-y-auto"
                        : "hidden max-h-40 overflow-y-auto"
                    }
                  >
                    <CommandEmpty>{t("noTeamsFound")}</CommandEmpty>
                    <CommandGroup>
                      {selectableTeams
                        .filter((team) =>
                          team.name
                            .toLowerCase()
                            .includes(teamSearch.toLowerCase()),
                        )
                        .map((team) => {
                          const isSelected = teamIds.includes(team.id);
                          return (
                            <CommandItem
                              key={team.id}
                              value={team.name}
                              onSelect={() => {
                                if (isSelected) {
                                  setTeamIds((prev) =>
                                    prev.filter((id) => id !== team.id),
                                  );
                                } else {
                                  setTeamIds((prev) => [...prev, team.id]);
                                }
                                setTeamSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {team.name}
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
              {teamIds.length > 0 && !teamListOpen && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {teamIds.map((teamId) => {
                    const team = selectableTeams.find((t) => t.id === teamId);
                    if (!team) return null;
                    return (
                      <Badge
                        key={teamId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {team.name}
                        <button
                          type="button"
                          onClick={() =>
                            setTeamIds((prev) =>
                              prev.filter((id) => id !== teamId),
                            )
                          }
                          className="hover:text-destructive ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <Textarea
            placeholder={t("messageOptionalPlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mb-4"
          />
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={pending || !isValidEmail}
          >
            {t("sendInviteBtn")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
