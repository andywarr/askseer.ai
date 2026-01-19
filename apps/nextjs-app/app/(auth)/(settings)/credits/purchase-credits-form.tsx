"use client";

import { type FormEvent, useMemo, useState, useCallback } from "react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { toast } from "sonner";
import { TeamSelector, type Team } from "./team-selector";

type PurchaseCreditsFormProps = {
  teams: Team[];
  unitPrice: number;
};

const MAX_CREDITS_PER_PURCHASE = 1000;

export function PurchaseCreditsForm({
  teams,
  unitPrice,
}: PurchaseCreditsFormProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [credits, setCredits] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");
  const [isPending, setIsPending] = useState(false);

  const normalizedUnitPrice = useMemo(
    () => (Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 19.99),
    [unitPrice],
  );
  const hasTeams = teams.length > 0;

  const formattedTotal = useMemo(() => {
    const total = Math.max(credits, 0) * normalizedUnitPrice;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total);
  }, [credits, normalizedUnitPrice]);

  const handleCreditsChange = useCallback((value: string) => {
    const numValue = Number(value);

    if (numValue > MAX_CREDITS_PER_PURCHASE) {
      setInputValue(MAX_CREDITS_PER_PURCHASE.toString());
      setCredits(MAX_CREDITS_PER_PURCHASE);
    } else {
      setInputValue(value);
      setCredits(numValue || 1);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedTeamId) {
        toast.error("Choose a team to assign the credits to.");
        return;
      }
      if (!Number.isFinite(credits) || credits < 1) {
        toast.error("Enter how many credits you want to purchase.");
        return;
      }

      setIsPending(true);
      try {
        const response = await fetch("/api/credits/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: selectedTeamId, credits }),
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
    [selectedTeamId, credits],
  );

  const handleTeamSelect = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col justify-between">
          <Label htmlFor="team" className="mb-3 block">
            Which team do you want to purchase credits for?
          </Label>
          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeamId}
            onTeamSelect={handleTeamSelect}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <Label htmlFor="credits" className="mb-3 block">
            How many credits do you want to purchase?
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="credits"
              type="number"
              min={1}
              max={MAX_CREDITS_PER_PURCHASE}
              value={inputValue}
              onChange={(event) => handleCreditsChange(event.target.value)}
              disabled={isPending}
              className="text-center"
              style={{ width: `${Math.max(inputValue.length + 7, 8)}ch` }}
            />
            <p className="text-muted-foreground text-xs text-zinc-500">
              Each credit costs{" "}
              {normalizedUnitPrice.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              .
            </p>
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

        <Button
          type="submit"
          disabled={
            !hasTeams ||
            isPending ||
            !selectedTeamId ||
            !Number.isFinite(credits) ||
            credits < 1
          }
          className="w-full sm:w-auto"
        >
          Checkout
        </Button>
      </div>
    </form>
  );
}
