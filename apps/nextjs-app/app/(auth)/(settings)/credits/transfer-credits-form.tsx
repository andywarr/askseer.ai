"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import { Check } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils";
import { toast } from "sonner";
import { transferCredits } from "@/apps/nextjs-app/lib/actions/credit-actions";

type TransferCreditsFormProps = {
  teams: Array<{
    id: string;
    name: string;
    isPersonal: boolean;
    credits: number;
  }>;
};

const MAX_CREDITS_PER_TRANSFER = 1000;

function getCreditColorClass(credits: number): string {
  if (credits <= 1) return "text-red-500";
  if (credits >= 2 && credits <= 9) return "text-amber-500";
  return "text-muted-foreground";
}

export function TransferCreditsForm({ teams }: TransferCreditsFormProps) {
  const [fromTeamId, setFromTeamId] = useState<string>("");
  const [toTeamId, setToTeamId] = useState<string>("");
  const [fromSearchValue, setFromSearchValue] = useState("");
  const [toSearchValue, setToSearchValue] = useState("");
  const [fromListOpen, setFromListOpen] = useState(false);
  const [toListOpen, setToListOpen] = useState(false);
  const [fromHasInteracted, setFromHasInteracted] = useState(false);
  const [toHasInteracted, setToHasInteracted] = useState(false);
  const [credits, setCredits] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");
  const [isPending, startTransition] = useTransition();

  const hasTeams = teams.length >= 2;

  // Filter teams for "from" selector (exclude the selected "to" team)
  const fromTeams = teams.filter((team) => team.id !== toTeamId);
  const fromRegularTeams = fromTeams.filter((team) => !team.isPersonal);
  const fromPersonalTeams = fromTeams.filter((team) => team.isPersonal);

  // Filter teams for "to" selector (exclude the selected "from" team)
  const toTeams = teams.filter((team) => team.id !== fromTeamId);
  const toRegularTeams = toTeams.filter((team) => !team.isPersonal);
  const toPersonalTeams = toTeams.filter((team) => team.isPersonal);

  const fromTeam = teams.find((team) => team.id === fromTeamId);
  const toTeam = teams.find((team) => team.id === toTeamId);

  const fromDisplayValue = fromTeam ? fromTeam.name : fromSearchValue;
  const toDisplayValue = toTeam ? toTeam.name : toSearchValue;

  // Max credits is either the from team's credits or the global max, whichever is smaller
  const maxCredits = fromTeam
    ? Math.min(fromTeam.credits, MAX_CREDITS_PER_TRANSFER)
    : MAX_CREDITS_PER_TRANSFER;

  // Clamp credits when from team changes
  useEffect(() => {
    if (fromTeam) {
      setCredits((prevCredits) => {
        if (prevCredits > fromTeam.credits) {
          const clamped = Math.max(1, fromTeam.credits);
          setInputValue(clamped.toString());
          return clamped;
        }
        return prevCredits;
      });
    }
  }, [fromTeam]);

  const handleCreditsChange = (value: string) => {
    const numValue = Number(value);

    if (numValue > maxCredits) {
      setInputValue(maxCredits.toString());
      setCredits(maxCredits);
    } else {
      setInputValue(value);
      setCredits(numValue || 1);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fromTeamId) {
      toast.error("Select a team to transfer credits from.");
      return;
    }
    if (!toTeamId) {
      toast.error("Select a team to transfer credits to.");
      return;
    }
    if (!Number.isFinite(credits) || credits < 1) {
      toast.error("Enter how many credits you want to transfer.");
      return;
    }

    const fromTeamCredits = fromTeam?.credits ?? 0;
    if (credits > fromTeamCredits) {
      toast.error(`The source team only has ${fromTeamCredits} credits.`);
      return;
    }

    startTransition(async () => {
      const result = await transferCredits({
        fromTeamId,
        toTeamId,
        credits,
      });

      if (!result.success) {
        toast.error(
          result.error || "Unable to transfer credits. Please try again.",
        );
        return;
      }

      toast.success(
        `Successfully transferred ${credits} credit${credits === 1 ? "" : "s"}.`,
      );
      // Reset form
      setFromTeamId("");
      setToTeamId("");
      setCredits(1);
      setInputValue("1");
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
        {/* From Team Selector */}
        <div className="flex-1">
          <Label htmlFor="from-team" className="mb-3 block">
            Which team would you like to transfer credits from?
          </Label>
          <div
            className={cn("w-full", (!hasTeams || isPending) && "opacity-50")}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(next)) {
                setFromListOpen(false);
              }
            }}
          >
            <Command className="relative rounded-md border">
              <CommandInput
                placeholder={
                  hasTeams ? "Select or search teams..." : "No eligible teams"
                }
                value={fromDisplayValue}
                disabled={!hasTeams || isPending}
                onClick={() => {
                  setFromHasInteracted(true);
                  setFromListOpen(true);
                }}
                onFocus={() => {
                  if (fromHasInteracted) {
                    setFromListOpen(true);
                  }
                }}
                onValueChange={(value) => {
                  setFromHasInteracted(true);
                  setFromSearchValue(value);
                  if (value !== fromDisplayValue) {
                    setFromTeamId("");
                  }
                  if (!fromListOpen) {
                    setFromListOpen(true);
                  }
                }}
                hideIcon
              />
              {fromTeam && !fromListOpen && (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs",
                    getCreditColorClass(fromTeam.credits),
                  )}
                >
                  {fromTeam.credits}{" "}
                  {fromTeam.credits === 1
                    ? "credit remaining"
                    : "credits remaining"}
                </span>
              )}
              <CommandList className={cn(fromListOpen ? "block" : "hidden")}>
                <CommandEmpty>No team found.</CommandEmpty>
                {fromTeam && (
                  <CommandItem
                    key="__clear_from__"
                    value="Clear selection"
                    onSelect={() => {
                      setFromTeamId("");
                      setFromSearchValue("");
                      setFromListOpen(false);
                    }}
                  >
                    <div className="truncate text-sm">Clear selection</div>
                  </CommandItem>
                )}
                {fromRegularTeams.length > 0 && (
                  <CommandGroup heading="Teams">
                    {fromRegularTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        disabled={team.credits === 0}
                        onSelect={() => {
                          if (team.credits === 0) return;
                          setFromTeamId(team.id);
                          setFromSearchValue("");
                          setFromListOpen(false);
                        }}
                        className={cn(team.credits === 0 && "opacity-50")}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            fromTeamId === team.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="flex-1">{team.name}</span>
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            getCreditColorClass(team.credits),
                          )}
                        >
                          {team.credits}{" "}
                          {team.credits === 1
                            ? "credit remaining"
                            : "credits remaining"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {fromPersonalTeams.length > 0 && (
                  <CommandGroup heading="Personal">
                    {fromPersonalTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        disabled={team.credits === 0}
                        onSelect={() => {
                          if (team.credits === 0) return;
                          setFromTeamId(team.id);
                          setFromSearchValue("");
                          setFromListOpen(false);
                        }}
                        className={cn(team.credits === 0 && "opacity-50")}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            fromTeamId === team.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="flex-1">{team.name}</span>
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            getCreditColorClass(team.credits),
                          )}
                        >
                          {team.credits}{" "}
                          {team.credits === 1
                            ? "credit remaining"
                            : "credits remaining"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>
        </div>

        {/* To Team Selector */}
        <div className="flex-1">
          <Label htmlFor="to-team" className="mb-3 block">
            Which team would you like to transfer credits to?
          </Label>
          <div
            className={cn("w-full", (!hasTeams || isPending) && "opacity-50")}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(next)) {
                setToListOpen(false);
              }
            }}
          >
            <Command className="relative rounded-md border">
              <CommandInput
                placeholder={
                  hasTeams ? "Select or search teams..." : "No eligible teams"
                }
                value={toDisplayValue}
                disabled={!hasTeams || isPending}
                onClick={() => {
                  setToHasInteracted(true);
                  setToListOpen(true);
                }}
                onFocus={() => {
                  if (toHasInteracted) {
                    setToListOpen(true);
                  }
                }}
                onValueChange={(value) => {
                  setToHasInteracted(true);
                  setToSearchValue(value);
                  if (value !== toDisplayValue) {
                    setToTeamId("");
                  }
                  if (!toListOpen) {
                    setToListOpen(true);
                  }
                }}
                hideIcon
              />
              {toTeam && !toListOpen && (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs",
                    getCreditColorClass(toTeam.credits),
                  )}
                >
                  {toTeam.credits}{" "}
                  {toTeam.credits === 1
                    ? "credit remaining"
                    : "credits remaining"}
                </span>
              )}
              <CommandList className={cn(toListOpen ? "block" : "hidden")}>
                <CommandEmpty>No team found.</CommandEmpty>
                {toTeam && (
                  <CommandItem
                    key="__clear_to__"
                    value="Clear selection"
                    onSelect={() => {
                      setToTeamId("");
                      setToSearchValue("");
                      setToListOpen(false);
                    }}
                  >
                    <div className="truncate text-sm">Clear selection</div>
                  </CommandItem>
                )}
                {toRegularTeams.length > 0 && (
                  <CommandGroup heading="Teams">
                    {toRegularTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        onSelect={() => {
                          setToTeamId(team.id);
                          setToSearchValue("");
                          setToListOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            toTeamId === team.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex-1">{team.name}</span>
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            getCreditColorClass(team.credits),
                          )}
                        >
                          {team.credits}{" "}
                          {team.credits === 1
                            ? "credit remaining"
                            : "credits remaining"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {toPersonalTeams.length > 0 && (
                  <CommandGroup heading="Personal">
                    {toPersonalTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        onSelect={() => {
                          setToTeamId(team.id);
                          setToSearchValue("");
                          setToListOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            toTeamId === team.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex-1">{team.name}</span>
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            getCreditColorClass(team.credits),
                          )}
                        >
                          {team.credits}{" "}
                          {team.credits === 1
                            ? "credit remaining"
                            : "credits remaining"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>
        </div>

        {/* Credits Input */}
        <div className="mb-4 flex-1 sm:mb-0">
          <Label htmlFor="transfer-credits" className="mb-3 block">
            How many credits would you like to transfer?
          </Label>
          <Input
            id="transfer-credits"
            type="number"
            min={1}
            max={maxCredits}
            value={inputValue}
            onChange={(event) => handleCreditsChange(event.target.value)}
            disabled={isPending}
            className="text-center"
            style={{ width: `${Math.max(inputValue.length + 7, 8)}ch` }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            !hasTeams ||
            isPending ||
            !fromTeamId ||
            !toTeamId ||
            !Number.isFinite(credits) ||
            credits < 1
          }
          className="w-full sm:w-auto"
        >
          Transfer
        </Button>
      </div>
    </form>
  );
}
