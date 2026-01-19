"use client";

import { type FormEvent, useEffect, useState, useMemo, useCallback } from "react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { toast } from "sonner";
import { transferCredits } from "@/apps/nextjs-app/lib/actions/credit-actions";
import { TeamSelector, type Team } from "./team-selector";

type TransferCreditsFormProps = {
  teams: Team[];
};

const MAX_CREDITS_PER_TRANSFER = 1000;

export function TransferCreditsForm({ teams }: TransferCreditsFormProps) {
  const [fromTeamId, setFromTeamId] = useState<string>("");
  const [toTeamId, setToTeamId] = useState<string>("");
  const [credits, setCredits] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");
  const [isPending, setIsPending] = useState(false);

  const hasTeams = teams.length >= 2;

  // Filter teams for "from" selector (exclude the selected "to" team)
  const fromTeams = useMemo(
    () => teams.filter((team) => team.id !== toTeamId),
    [teams, toTeamId],
  );

  // Filter teams for "to" selector (exclude the selected "from" team)
  const toTeams = useMemo(
    () => teams.filter((team) => team.id !== fromTeamId),
    [teams, fromTeamId],
  );

  const fromTeam = useMemo(
    () => teams.find((team) => team.id === fromTeamId),
    [teams, fromTeamId],
  );

  // Max credits is either the from team's credits or the global max, whichever is smaller
  const maxCredits = useMemo(
    () =>
      fromTeam
        ? Math.min(fromTeam.credits, MAX_CREDITS_PER_TRANSFER)
        : MAX_CREDITS_PER_TRANSFER,
    [fromTeam],
  );

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

  const handleCreditsChange = useCallback(
    (value: string) => {
      const numValue = Number(value);

      if (numValue > maxCredits) {
        setInputValue(maxCredits.toString());
        setCredits(maxCredits);
      } else {
        setInputValue(value);
        setCredits(numValue || 1);
      }
    },
    [maxCredits],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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

      setIsPending(true);
      try {
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
      } finally {
        setIsPending(false);
      }
    },
    [fromTeamId, toTeamId, credits, fromTeam],
  );

  const handleFromTeamSelect = useCallback((teamId: string) => {
    setFromTeamId(teamId);
  }, []);

  const handleToTeamSelect = useCallback((teamId: string) => {
    setToTeamId(teamId);
  }, []);

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
        {/* From Team Selector */}
        <div className="flex-1">
          <Label htmlFor="from-team" className="mb-3 block">
            Which team would you like to transfer credits from?
          </Label>
          <TeamSelector
            teams={fromTeams}
            selectedTeamId={fromTeamId}
            onTeamSelect={handleFromTeamSelect}
            disabled={isPending}
            showCreditsRemaining
            disableZeroCredits
          />
        </div>

        {/* To Team Selector */}
        <div className="flex-1">
          <Label htmlFor="to-team" className="mb-3 block">
            Which team would you like to transfer credits to?
          </Label>
          <TeamSelector
            teams={toTeams}
            selectedTeamId={toTeamId}
            onTeamSelect={handleToTeamSelect}
            disabled={isPending}
            showCreditsRemaining
          />
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

      <div className="mt-2 flex justify-end">
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
