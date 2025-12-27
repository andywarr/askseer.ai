"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  Check,
  User,
  UsersRound,
  CreditCard,
} from "lucide-react";

import { updateSelectedTeamAction } from "@/apps/nextjs-app/lib/action";
import { Button } from "@/apps/nextjs-app/components/ui/button";
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
import { cn } from "@/apps/nextjs-app/lib/utils";

export interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  companyId?: string | null;
  companyName?: string | null;
  isDefaultForCompany?: boolean;
  role?: string;
}

interface FormTeamSwitcherProps {
  currentTeamId: string | null;
  userTeams: Team[];
  credits?: number;
  canPurchaseCredits?: boolean;
}

function formatTeamName(team: Team): string {
  if (team.isPersonal) {
    return `${team.name} (Personal)`;
  }
  return team.name;
}

export function FormTeamSwitcher({
  currentTeamId,
  userTeams,
  credits,
  canPurchaseCredits,
}: FormTeamSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeTeamId, setActiveTeamId] = useState(currentTeamId);

  // Don't render if user only has one team
  if (userTeams.length <= 1) {
    return null;
  }

  const activeTeam = userTeams.find((t) => t.id === activeTeamId) ?? null;

  // Sort teams: personal teams first, then default company team, then other teams by name
  const sortedTeams = [...userTeams].sort((a, b) => {
    if (a.isPersonal && !b.isPersonal) return -1;
    if (!a.isPersonal && b.isPersonal) return 1;
    if (a.isDefaultForCompany && !b.isDefaultForCompany) return -1;
    if (!a.isDefaultForCompany && b.isDefaultForCompany) return 1;
    return a.name.localeCompare(b.name);
  });

  // Group teams by type
  const personalTeams = sortedTeams.filter((t) => t.isPersonal);
  const defaultCompanyTeam = sortedTeams.find(
    (t) => !t.isPersonal && t.isDefaultForCompany,
  );
  const otherCompanyTeams = sortedTeams.filter(
    (t) => !t.isPersonal && !t.isDefaultForCompany,
  );

  const handleTeamSelect = (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      setOpen(false);
      return;
    }
    const targetTeam = sortedTeams.find((team) => team.id === teamId) ?? null;
    setOpen(false);
    startTransition(async () => {
      try {
        await updateSelectedTeamAction(teamId);
        setActiveTeamId(teamId);
        if (targetTeam) {
          toast.success(`Switched to ${formatTeamName(targetTeam)}`);
        } else {
          toast.success("Active team updated");
        }
        // Refresh to update the page with new team data
        router.refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to switch team";
        toast.error(message);
      }
    });
  };

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center gap-2">
        {activeTeam?.isPersonal ? (
          <User className="h-4 w-4 text-zinc-500" />
        ) : activeTeam?.isDefaultForCompany ? (
          <Building2 className="h-4 w-4 text-zinc-500" />
        ) : (
          <UsersRound className="h-4 w-4 text-zinc-500" />
        )}
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Creating for:
        </span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] justify-between"
            disabled={isPending}
          >
            <span className="truncate">
              {activeTeam ? formatTeamName(activeTeam) : "Select team..."}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search teams..." />
            <CommandList>
              <CommandEmpty>No team found.</CommandEmpty>
              {personalTeams.length > 0 && (
                <CommandGroup heading="Personal">
                  {personalTeams.map((team) => (
                    <CommandItem
                      key={team.id}
                      value={team.id}
                      onSelect={() => handleTeamSelect(team.id)}
                      className="flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-zinc-500" />
                      <span className="flex-1 truncate">
                        {formatTeamName(team)}
                      </span>
                      {team.id === activeTeamId && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {otherCompanyTeams.length > 0 && (
                <CommandGroup heading="Teams">
                  {otherCompanyTeams.map((team) => (
                    <CommandItem
                      key={team.id}
                      value={team.id}
                      onSelect={() => handleTeamSelect(team.id)}
                      className="flex items-center gap-2"
                    >
                      <UsersRound className="h-4 w-4 text-zinc-500" />
                      <span className="flex-1 truncate">{team.name}</span>
                      {team.id === activeTeamId && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {defaultCompanyTeam && (
                <CommandGroup heading="Company">
                  <CommandItem
                    key={defaultCompanyTeam.id}
                    value={defaultCompanyTeam.id}
                    onSelect={() => handleTeamSelect(defaultCompanyTeam.id)}
                    className="flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4 text-zinc-500" />
                    <span className="flex-1 truncate">
                      {defaultCompanyTeam.name}
                    </span>
                    {defaultCompanyTeam.id === activeTeamId && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {typeof credits === "number" && (
        <div className="flex flex-1 items-center justify-between">
          <span
            className={cn(
              "text-sm",
              credits <= 1
                ? "text-red-500"
                : credits <= 9
                  ? "text-amber-500"
                  : "text-zinc-500",
            )}
          >
            {credits} {credits === 1 ? "credit" : "credits"} available
          </span>
          {credits <= 9 &&
            canPurchaseCredits &&
            activeTeam?.role &&
            ["OWNER", "ADMIN"].includes(activeTeam.role) && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/credits">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Credits
                </Link>
              </Button>
            )}
        </div>
      )}
    </div>
  );
}
