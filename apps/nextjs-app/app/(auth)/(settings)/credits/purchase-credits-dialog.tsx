"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import { toast } from "sonner";

type PurchaseCreditsDialogProps = {
  teams: Array<{
    id: string;
    name: string;
    isPersonal: boolean;
  }>;
  unitPrice: number;
};

const MAX_CREDITS_PER_PURCHASE = 1000;

export function PurchaseCreditsDialog({ teams, unitPrice }: PurchaseCreditsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? "");
  const [credits, setCredits] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  const normalizedUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 19.99;
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

  const handleCreditsChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setCredits(1);
      return;
    }
    setCredits(Math.min(Math.max(parsed, 1), MAX_CREDITS_PER_PURCHASE));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeamId) {
      toast.error("Choose a team to assign the credits to.");
      return;
    }
    if (!Number.isFinite(credits) || credits < 1) {
      toast.error("Enter how many credits you want to purchase.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeamId, credits }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data?.error || "Unable to start checkout. Please try again.");
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      toast.error("Unable to start checkout. Please try again.");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasTeams}>Add Credits</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase credits</DialogTitle>
          <DialogDescription>
            Choose a team, enter the number of credits, and continue to checkout.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <Select
              value={selectedTeamId}
              onValueChange={setSelectedTeamId}
              disabled={!hasTeams || isPending}
            >
              <SelectTrigger id="team">
                <SelectValue placeholder={hasTeams ? "Select a team" : "No eligible teams"} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credits">Credits</Label>
            <Input
              id="credits"
              type="number"
              min={1}
              max={MAX_CREDITS_PER_PURCHASE}
              value={credits}
              onChange={(event) => handleCreditsChange(event.target.value)}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              Each credit costs {normalizedUnitPrice.toLocaleString("en-US", { style: "currency", currency: "USD" })}.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tracking-tight">{formattedTotal}</span>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!hasTeams || isPending}>
              {isPending ? "Opening checkout…" : "Start checkout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
