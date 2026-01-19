"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { type TeamForDisplay as Team } from "./types";

export type { Team };

interface TeamSelectorProps {
  teams: Team[];
  selectedTeamId: string;
  onTeamSelect: (teamId: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  emptyPlaceholder?: string;
  showCreditsRemaining?: boolean;
  disableZeroCredits?: boolean;
}

function getCreditColorClass(credits: number): string {
  if (credits <= 1) return "text-red-500";
  if (credits >= 2 && credits <= 9) return "text-amber-500";
  return "text-muted-foreground";
}

function formatCreditsLabel(
  credits: number,
  showRemaining: boolean = false,
): string {
  if (showRemaining) {
    return credits === 1 ? "credit remaining" : "credits remaining";
  }
  return credits === 1 ? "credit" : "credits";
}

export const TeamSelector = memo(function TeamSelector({
  teams,
  selectedTeamId,
  onTeamSelect,
  disabled = false,
  placeholder = "Select or search teams...",
  emptyPlaceholder = "No eligible teams",
  showCreditsRemaining = false,
  disableZeroCredits = false,
}: TeamSelectorProps) {
  const [searchValue, setSearchValue] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const regularTeams = useMemo(
    () => teams.filter((team) => !team.isPersonal),
    [teams],
  );

  const personalTeams = useMemo(
    () => teams.filter((team) => team.isPersonal),
    [teams],
  );

  const hasTeams = teams.length > 0;
  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [teams, selectedTeamId],
  );
  const displayValue = selectedTeam ? selectedTeam.name : searchValue;

  // Auto-select team if there's only one eligible team
  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      onTeamSelect(teams[0].id);
    }
  }, [teams, selectedTeamId, onTeamSelect]);

  const handleSelect = useCallback(
    (teamId: string) => {
      onTeamSelect(teamId);
      setSearchValue("");
      setListOpen(false);
    },
    [onTeamSelect],
  );

  const handleClear = useCallback(() => {
    onTeamSelect("");
    setSearchValue("");
    setListOpen(false);
  }, [onTeamSelect]);

  const handleInputClick = useCallback(() => {
    setHasInteracted(true);
    setListOpen(true);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (hasInteracted) {
      setListOpen(true);
    }
  }, [hasInteracted]);

  const handleValueChange = useCallback(
    (value: string) => {
      setHasInteracted(true);
      setSearchValue(value);
      if (value !== displayValue) {
        onTeamSelect("");
      }
      if (!listOpen) {
        setListOpen(true);
      }
    },
    [displayValue, listOpen, onTeamSelect],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(next)) {
        setListOpen(false);
      }
    },
    [],
  );

  const renderTeamItem = useCallback(
    (team: Team) => {
      const isDisabled = disableZeroCredits && team.credits === 0;
      return (
        <CommandItem
          key={team.id}
          value={team.name}
          disabled={isDisabled}
          onSelect={() => {
            if (!isDisabled) {
              handleSelect(team.id);
            }
          }}
          className={cn(isDisabled && "opacity-50")}
        >
          <Check
            className={cn(
              "mr-2 h-4 w-4",
              selectedTeamId === team.id ? "opacity-100" : "opacity-0",
            )}
          />
          <span className="flex-1">{team.name}</span>
          <span
            className={cn("ml-2 text-xs", getCreditColorClass(team.credits))}
          >
            {team.credits} {formatCreditsLabel(team.credits, showCreditsRemaining)}
          </span>
        </CommandItem>
      );
    },
    [selectedTeamId, handleSelect, disableZeroCredits, showCreditsRemaining],
  );

  return (
    <div
      className={cn("w-full", (!hasTeams || disabled) && "opacity-50")}
      onBlur={handleBlur}
    >
      <Command className="relative rounded-md border">
        <CommandInput
          placeholder={hasTeams ? placeholder : emptyPlaceholder}
          value={displayValue}
          disabled={!hasTeams || disabled}
          onClick={handleInputClick}
          onFocus={handleInputFocus}
          onValueChange={handleValueChange}
          hideIcon
        />
        {selectedTeam && !listOpen && showCreditsRemaining && (
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs",
              getCreditColorClass(selectedTeam.credits),
            )}
          >
            {selectedTeam.credits}{" "}
            {formatCreditsLabel(selectedTeam.credits, true)}
          </span>
        )}
        <CommandList className={cn(listOpen ? "block" : "hidden")}>
          <CommandEmpty>No team found.</CommandEmpty>
          {selectedTeam && (
            <CommandItem
              key="__clear__"
              value="Clear selection"
              onSelect={handleClear}
            >
              <div className="truncate text-sm">Clear selection</div>
            </CommandItem>
          )}
          {regularTeams.length > 0 && (
            <CommandGroup heading="Teams">
              {regularTeams.map(renderTeamItem)}
            </CommandGroup>
          )}
          {personalTeams.length > 0 && (
            <CommandGroup heading="Personal">
              {personalTeams.map(renderTeamItem)}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
});
