"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";

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

type PurchaseCreditsFormProps = {
  teams: Array<{
    id: string;
    name: string;
    isPersonal: boolean;
  }>;
  unitPrice: number;
};

const MAX_CREDITS_PER_PURCHASE = 1000;

export function PurchaseCreditsForm({
  teams,
  unitPrice,
}: PurchaseCreditsFormProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [searchValue, setSearchValue] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [credits, setCredits] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  const normalizedUnitPrice =
    Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 19.99;
  const hasTeams = teams.length > 0;

  const regularTeams = teams.filter((team) => !team.isPersonal);
  const personalTeams = teams.filter((team) => team.isPersonal);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const displayValue = selectedTeam ? selectedTeam.name : searchValue;

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
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Label htmlFor="team" className="mb-3 block">
            What team do you want to purchase credits for?
          </Label>
          <div
            className={cn("w-full", (!hasTeams || isPending) && "opacity-50")}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(next)) {
                setListOpen(false);
              }
            }}
          >
            <Command className="rounded-md border">
              <CommandInput
                placeholder={
                  hasTeams ? "Select or search teams..." : "No eligible teams"
                }
                value={displayValue}
                disabled={!hasTeams || isPending}
                onClick={() => {
                  setHasInteracted(true);
                  setListOpen(true);
                }}
                onFocus={(e) => {
                  if (hasInteracted) {
                    setListOpen(true);
                  }
                }}
                onValueChange={(value) => {
                  setHasInteracted(true);
                  setSearchValue(value);
                  if (value !== displayValue) {
                    setSelectedTeamId("");
                  }
                  if (!listOpen) {
                    setListOpen(true);
                  }
                }}
                hideIcon
              />
              <CommandList className={cn(listOpen ? "block" : "hidden")}>
                <CommandEmpty>No team found.</CommandEmpty>
                {selectedTeam && (
                  <CommandItem
                    key="__clear__"
                    value="Clear selection"
                    onSelect={() => {
                      setSelectedTeamId("");
                      setSearchValue("");
                      setListOpen(false);
                    }}
                  >
                    <div className="truncate text-sm">Clear selection</div>
                  </CommandItem>
                )}
                {regularTeams.length > 0 && (
                  <CommandGroup heading="Teams">
                    {regularTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        onSelect={() => {
                          setSelectedTeamId(team.id);
                          setSearchValue("");
                          setListOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeamId === team.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {team.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {personalTeams.length > 0 && (
                  <CommandGroup heading="Personal">
                    {personalTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        onSelect={() => {
                          setSelectedTeamId(team.id);
                          setSearchValue("");
                          setListOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeamId === team.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {team.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>
        </div>

        <div className="flex-1">
          <Label htmlFor="credits" className="mb-3 block">
            How many credits do you want to purchase?
          </Label>
          <Input
            id="credits"
            type="number"
            min={1}
            max={MAX_CREDITS_PER_PURCHASE}
            value={credits}
            onChange={(event) => handleCreditsChange(event.target.value)}
            disabled={isPending}
          />
          <p className="text-muted-foreground mt-2 text-sm">
            Each credit costs{" "}
            {normalizedUnitPrice.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
            .
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="text-2xl font-semibold tracking-tight">
            {formattedTotal}
          </span>
        </div>

        <Button
          type="submit"
          disabled={!hasTeams || isPending}
          className="w-full sm:w-auto"
        >
          Checkout
        </Button>
      </div>
    </form>
  );
}
