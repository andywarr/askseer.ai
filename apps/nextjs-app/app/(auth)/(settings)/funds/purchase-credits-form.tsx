"use client";

import { type FormEvent, useMemo, useState, useCallback } from "react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";
import { TeamSelector, type Team } from "./team-selector";
import { DollarInput } from "./dollar-input";
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
  MAX_FUND_AMOUNT_CENTS,
} from "@/apps/shared/constants";

type PurchaseCreditsFormProps = {
  teams: Team[];
};

export function PurchaseCreditsForm({ teams }: PurchaseCreditsFormProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [amountDollars, setAmountDollars] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const hasTeams = teams.length > 0;

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const minFundAmountCents = useMemo(
    () =>
      selectedTeam?.companyId
        ? COMPANY_STUDY_COST_CENTS
        : PERSONAL_STUDY_COST_CENTS,
    [selectedTeam],
  );

  const minFundDollars = useMemo(
    () => (minFundAmountCents / 100).toFixed(2),
    [minFundAmountCents],
  );

  const amountCents = useMemo(() => {
    const parsed = parseFloat(amountDollars);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amountDollars]);

  const formattedTotal = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  }, [amountCents]);

  const handleAmountChange = useCallback((value: string) => {
    setAmountDollars(value);
  }, []);

  const handleAmountBlur = useCallback(() => {
    const parsed = parseFloat(amountDollars);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmountDollars(parsed.toFixed(2));
    }
  }, [amountDollars]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedTeamId) {
        toast.error("Choose a team to add funds to.");
        return;
      }
      if (amountCents < minFundAmountCents) {
        toast.error(`Minimum amount is $${minFundDollars}.`);
        return;
      }
      if (amountCents > MAX_FUND_AMOUNT_CENTS) {
        toast.error(
          `Maximum amount is $${(MAX_FUND_AMOUNT_CENTS / 100).toFixed(2)}.`,
        );
        return;
      }

      setIsPending(true);
      try {
        const response = await fetch("/api/credits/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: selectedTeamId, amountCents }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast.error(
            data?.error || "Unable to start checkout. Please try again.",
          );
          return;
        }

        const data = (await response.json().catch(() => ({}))) as {
          url?: string;
        };
        if (data?.url) {
          window.location.href = data.url;
          return;
        }

        toast.error("Unable to start checkout. Please try again.");
      } finally {
        setIsPending(false);
      }
    },
    [selectedTeamId, amountCents],
  );

  const handleTeamSelect = useCallback(
    (teamId: string) => {
      setSelectedTeamId(teamId);
      if (teamId) {
        const team = teams.find((t) => t.id === teamId);
        const min = team?.companyId
          ? COMPANY_STUDY_COST_CENTS
          : PERSONAL_STUDY_COST_CENTS;
        setAmountDollars((min / 100).toFixed(2));
      }
    },
    [teams],
  );

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col justify-between">
          <Label htmlFor="team" className="mb-3 block">
            Which team do you want to add funds to?
          </Label>
          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeamId}
            onTeamSelect={handleTeamSelect}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <Label htmlFor="amount" className="mb-3 block">
            How much would you like to add?
          </Label>
          <div className="flex items-center gap-2">
            <DollarInput
              id="amount"
              value={amountDollars}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="text-2xl font-semibold tracking-tight">
            {formattedTotal}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            type="submit"
            disabled={
              !hasTeams ||
              isPending ||
              !selectedTeamId ||
              amountCents < minFundAmountCents
            }
            className="w-full sm:w-auto"
          >
            Checkout
          </Button>
          {selectedTeamId && amountCents < minFundAmountCents && (
            <p className="text-xs text-red-500">
              Minimum amount is ${minFundDollars}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
