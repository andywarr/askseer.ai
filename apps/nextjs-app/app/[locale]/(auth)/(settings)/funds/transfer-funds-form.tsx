"use client";

import {
  type FormEvent,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";
import { transferBalance } from "@/apps/nextjs-app/lib/actions/balance-actions";
import { TeamSelector, type Team } from "./team-selector";
import { DollarInput } from "./dollar-input";
import { useTranslations, useLocale } from "next-intl";

type TransferFundsFormProps = {
  teams: Team[];
};

export function TransferFundsForm({ teams }: TransferFundsFormProps) {
  const t = useTranslations("FundsSettings");
  const locale = useLocale();
  const [fromTeamId, setFromTeamId] = useState<string>("");
  const [toTeamId, setToTeamId] = useState<string>("");
  const [amountDollars, setAmountDollars] = useState<string>("1.00");
  const [isPending, setIsPending] = useState(false);

  const hasTeams = teams.length >= 2;

  const amountCents = useMemo(() => {
    const parsed = parseFloat(amountDollars);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amountDollars]);

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

  // Max amount is either the from team's balance or a reasonable max
  const maxAmountCents = useMemo(
    () => (fromTeam ? fromTeam.balanceCents : 50000000),
    [fromTeam],
  );

  // Clamp amount when from team changes
  useEffect(() => {
    if (fromTeam && amountCents > fromTeam.balanceCents) {
      const clampedDollars = Math.max(0.01, fromTeam.balanceCents / 100);
      setAmountDollars(clampedDollars.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTeam]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!fromTeamId) {
        toast.error(t("validation.pleaseSelectSourceTeam"));
        return;
      }
      if (!toTeamId) {
        toast.error(t("validation.pleaseSelectDestinationTeam"));
        return;
      }
      if (amountCents < 1) {
        toast.error(
          t("validation.minAmountRequiredTransfer", {
            amount: new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "USD",
            }).format(0.01),
          })
        );
        return;
      }

      const fromTeamBalance = fromTeam?.balanceCents ?? 0;
      if (amountCents > fromTeamBalance) {
        toast.error(
          t("validation.insufficientSourceBalance", {
            amount: new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "USD",
            }).format(fromTeamBalance / 100),
          }),
        );
        return;
      }

      setIsPending(true);
      try {
        const result = await transferBalance({
          fromTeamId,
          toTeamId,
          amountCents,
        });

        if (!result.success) {
          toast.error(
            result.error || t("errors.somethingWentWrong"),
          );
          return;
        }

        toast.success(
          t("forms.transfer.success", {
            amount: new Intl.NumberFormat(locale, {
              style: "currency",
              currency: "USD",
            }).format(amountCents / 100),
          }),
        );
        // Reset form
        setFromTeamId("");
        setToTeamId("");
        setAmountDollars("1.00");
      } finally {
        setIsPending(false);
      }
    },
    [fromTeamId, toTeamId, amountCents, fromTeam, t, locale],
  );

  const handleFromTeamSelect = useCallback((teamId: string) => {
    setFromTeamId(teamId);
  }, []);

  const handleToTeamSelect = useCallback((teamId: string) => {
    setToTeamId(teamId);
  }, []);

  const handleAmountChange = useCallback((value: string) => {
    setAmountDollars(value);
  }, []);

  const handleAmountBlur = useCallback(() => {
    const parsed = parseFloat(amountDollars);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmountDollars(parsed.toFixed(2));
    }
  }, [amountDollars]);

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
        {/* From Team Selector */}
        <div className="flex-1">
          <Label htmlFor="from-team" className="mb-3 block">
            {t("forms.transfer.fromTeamLabel")}
          </Label>
          <TeamSelector
            teams={fromTeams}
            selectedTeamId={fromTeamId}
            onTeamSelect={handleFromTeamSelect}
            disabled={isPending}
            showCreditsRemaining
            disableZeroBalance
          />
        </div>

        {/* To Team Selector */}
        <div className="flex-1">
          <Label htmlFor="to-team" className="mb-3 block">
            {t("forms.transfer.toTeamLabel")}
          </Label>
          <TeamSelector
            teams={toTeams}
            selectedTeamId={toTeamId}
            onTeamSelect={handleToTeamSelect}
            disabled={isPending}
            showCreditsRemaining
          />
        </div>

        {/* Amount Input */}
        <div className="mb-4 flex-1 sm:mb-0">
          <Label htmlFor="transfer-amount" className="mb-3 block">
            {t("forms.transfer.amountLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <DollarInput
              id="transfer-amount"
              value={amountDollars}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              disabled={isPending}
              max={fromTeam ? fromTeam.balanceCents / 100 : undefined}
            />
          </div>
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
            amountCents < 1
          }
          className="w-full sm:w-auto"
        >
          {t("forms.transfer.submit")}
        </Button>
      </div>
    </form>
  );
}
