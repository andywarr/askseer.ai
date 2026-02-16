"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
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
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

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
  disableZeroBalance?: boolean;
  "aria-label"?: string;
  id?: string;
}

function getBalanceColorClass(
  balanceCents: number,
  companyId?: string | null,
): string {
  const studyCostCents = companyId
    ? COMPANY_STUDY_COST_CENTS
    : PERSONAL_STUDY_COST_CENTS;
  if (balanceCents < studyCostCents) return "text-red-500";
  if (balanceCents < studyCostCents * 2) return "text-amber-500";
  return "text-muted-foreground";
}

function formatBalance(balanceCents: number): string {
  return `$${(balanceCents / 100).toFixed(2)}`;
}

function formatBalanceLabel(
  balanceCents: number,
  showRemaining: boolean = false,
): string {
  if (showRemaining) {
    return "remaining";
  }
  return "";
}

// Custom debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export const TeamSelector = memo(function TeamSelector({
  teams,
  selectedTeamId,
  onTeamSelect,
  disabled = false,
  placeholder = "Select or search teams...",
  emptyPlaceholder = "No eligible teams",
  showCreditsRemaining = false,
  disableZeroBalance = false,
  "aria-label": ariaLabel,
  id,
}: TeamSelectorProps) {
  const [searchValue, setSearchValue] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the user has manually cleared the selection;
  // prevents auto-select from re-firing after a deliberate clear.
  const userClearedRef = useRef(false);

  // Debounce search for performance with large team lists
  const debouncedSearchValue = useDebouncedValue(searchValue, 150);

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
    if (!userClearedRef.current && teams.length === 1 && !selectedTeamId) {
      onTeamSelect(teams[0].id);
    }
  }, [teams, selectedTeamId, onTeamSelect]);

  // Announce team selection to screen readers
  const announceSelection = useCallback((teamName: string) => {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = `Selected team: ${teamName}`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }, []);

  const handleSelect = useCallback(
    (teamId: string) => {
      // Toggle: clicking the already-selected team deselects it
      if (teamId === selectedTeamId) {
        userClearedRef.current = true;
        onTeamSelect("");
        setSearchValue("");
        setListOpen(false);
        return;
      }
      const team = teams.find((t) => t.id === teamId);
      onTeamSelect(teamId);
      setSearchValue("");
      setListOpen(false);
      if (team) {
        announceSelection(team.name);
      }
    },
    [onTeamSelect, teams, announceSelection, selectedTeamId],
  );

  const handleClear = useCallback(() => {
    userClearedRef.current = true;
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

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(next)) {
      setListOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        setListOpen(false);
        inputRef.current?.blur();
      }
      // When a team is selected, Backspace/Delete clears the selection
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedTeamId
      ) {
        userClearedRef.current = true;
        onTeamSelect("");
        setSearchValue("");
        setListOpen(true);
      }
    },
    [selectedTeamId, onTeamSelect],
  );

  const renderTeamItem = useCallback(
    (team: Team) => {
      const isDisabled = disableZeroBalance && team.balanceCents === 0;
      const isSelected = selectedTeamId === team.id;
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
          aria-selected={isSelected}
          role="option"
        >
          <Check
            className={cn(
              "mr-2 h-4 w-4",
              isSelected ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          />
          <span className="flex-1">{team.name}</span>
          <span
            className={cn(
              "ml-2 text-xs",
              getBalanceColorClass(team.balanceCents, team.companyId),
            )}
            aria-label={`${formatBalance(team.balanceCents)} ${formatBalanceLabel(team.balanceCents, showCreditsRemaining)}`}
          >
            {formatBalance(team.balanceCents)}{" "}
            {formatBalanceLabel(team.balanceCents, showCreditsRemaining)}
          </span>
        </CommandItem>
      );
    },
    [selectedTeamId, handleSelect, disableZeroBalance, showCreditsRemaining],
  );

  return (
    <div
      className={cn("w-full", (!hasTeams || disabled) && "opacity-50")}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <Command
        className="relative rounded-md border"
        aria-label={ariaLabel || "Team selector"}
      >
        <CommandInput
          ref={inputRef}
          id={id}
          placeholder={hasTeams ? placeholder : emptyPlaceholder}
          value={displayValue}
          disabled={!hasTeams || disabled}
          onClick={handleInputClick}
          onFocus={handleInputFocus}
          onValueChange={handleValueChange}
          hideIcon
          aria-describedby={selectedTeam ? `${id}-selection` : undefined}
        />
        {selectedTeam && !listOpen && showCreditsRemaining && (
          <span
            id={id ? `${id}-selection` : undefined}
            className={cn(
              "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs",
              getBalanceColorClass(selectedTeam.balanceCents, selectedTeam.companyId),
            )}
            aria-live="polite"
          >
            {formatBalance(selectedTeam.balanceCents)}{" "}
            {formatBalanceLabel(selectedTeam.balanceCents, true)}
          </span>
        )}
        <CommandList
          className={cn(listOpen ? "block" : "hidden")}
          role="listbox"
          aria-label="Available teams"
        >
          <CommandEmpty>No team found.</CommandEmpty>
          {selectedTeam && (
            <CommandItem
              key="__clear__"
              value="Clear selection"
              onSelect={handleClear}
              role="option"
            >
              <div className="truncate text-sm">Clear selection</div>
            </CommandItem>
          )}
          {regularTeams.length > 0 && (
            <CommandGroup
              heading="Teams"
              role="group"
              aria-label="Regular teams"
            >
              {regularTeams.map(renderTeamItem)}
            </CommandGroup>
          )}
          {personalTeams.length > 0 && (
            <CommandGroup
              heading="Personal"
              role="group"
              aria-label="Personal teams"
            >
              {personalTeams.map(renderTeamItem)}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
});
