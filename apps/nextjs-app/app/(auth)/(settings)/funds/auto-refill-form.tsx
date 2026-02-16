"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { DollarInput } from "./dollar-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";

import {
  getAutoRefillSettings,
  updateAutoRefillSettings,
  createCheckoutSessionForPaymentSetup,
  processCheckoutSuccess,
  removePaymentMethod,
} from "@/apps/nextjs-app/lib/actions/balance-actions";
import { TeamSelector, type Team } from "./team-selector";
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

type AutoRefillSettings = {
  autoRefillEnabled: boolean;
  autoRefillThreshold: number | null;
  autoRefillAmount: number | null;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
};

type AutoRefillFormProps = {
  teams: Team[];
};

const MAX_THRESHOLD_CENTS = 1000000; // $10,000
const MAX_AMOUNT_CENTS = 500000; // $5,000

// Extracted Payment Method Display Component
const PaymentMethodDisplay = memo(function PaymentMethodDisplay({
  settings,
  onUpdate,
  onRemove,
  isPaymentPending,
  isPending,
  disabled,
}: {
  settings: AutoRefillSettings | null;
  onUpdate: () => void;
  onRemove: () => void;
  isPaymentPending: boolean;
  isPending: boolean;
  disabled: boolean;
}) {
  if (!settings?.paymentMethodLast4) {
    return null;
  }

  return (
    <>
      <div className="bg-muted flex h-8 w-12 items-center justify-center rounded border">
        <span className="text-xs font-medium uppercase">
          {settings.paymentMethodBrand}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium">
          •••• {settings.paymentMethodLast4}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onUpdate}
        disabled={isPaymentPending || disabled}
      >
        {isPaymentPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isPaymentPending || disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment Method?</DialogTitle>
            <DialogDescription>
              This will also disable auto-refill for this team. You can add a
              new payment method at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={onRemove}
              disabled={isPending}
            >
              Remove Payment Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

export function AutoRefillForm({ teams }: AutoRefillFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [settings, setSettings] = useState<AutoRefillSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const hasProcessedCheckoutRef = useRef(false);

  // Form state (displayed as dollars, stored as cents)
  const initialMinCents = teams.some((t) => t.companyId)
    ? COMPANY_STUDY_COST_CENTS
    : PERSONAL_STUDY_COST_CENTS;
  const [thresholdDollars, setThresholdDollars] = useState<string>(
    (initialMinCents / 100).toFixed(2),
  );
  const [amountDollars, setAmountDollars] = useState<string>("0.00");

  // Dynamic minimum based on selected team type
  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const minRefillAmountCents = useMemo(
    () =>
      selectedTeam?.companyId
        ? COMPANY_STUDY_COST_CENTS
        : PERSONAL_STUDY_COST_CENTS,
    [selectedTeam],
  );

  const minRefillDollars = useMemo(
    () => (minRefillAmountCents / 100).toFixed(2),
    [minRefillAmountCents],
  );

  // Convert to cents for storage
  const threshold = useMemo(() => {
    const parsed = parseFloat(thresholdDollars);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [thresholdDollars]);

  const amount = useMemo(() => {
    const parsed = parseFloat(amountDollars);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amountDollars]);

  // Memoized computed values
  const hasPaymentMethod = useMemo(
    () => Boolean(settings?.paymentMethodLast4),
    [settings?.paymentMethodLast4],
  );

  const isAutoRefillActive = useMemo(
    () => settings?.autoRefillEnabled && hasPaymentMethod,
    [settings?.autoRefillEnabled, hasPaymentMethod],
  );

  const hasChanges = useMemo(
    () =>
      isAutoRefillActive &&
      (threshold !== settings?.autoRefillThreshold ||
        amount !== settings?.autoRefillAmount),
    [isAutoRefillActive, threshold, amount, settings],
  );

  const estimatedCost = useMemo(() => (amount / 100).toFixed(2), [amount]);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const setupSuccess = searchParams.get("setup_success");
    const setupCancelled = searchParams.get("setup_cancelled");
    const teamId = searchParams.get("team");
    const sessionId = searchParams.get("session_id");

    if (setupCancelled && teamId) {
      toast.info("Payment setup was cancelled");
      router.replace("/funds", { scroll: false });
      setSelectedTeamId(teamId);
      return;
    }

    if (
      setupSuccess &&
      teamId &&
      sessionId &&
      !hasProcessedCheckoutRef.current
    ) {
      hasProcessedCheckoutRef.current = true;
      setProcessingCheckout(true);
      setSelectedTeamId(teamId);

      router.replace("/funds", { scroll: false });

      processCheckoutSuccess(sessionId, teamId)
        .then((result) => {
          if (result.success && result.data) {
            toast.success(`Payment method •••• ${result.data.last4} saved`);
            return getAutoRefillSettings(teamId);
          } else if (!result.success) {
            toast.error(result.error || "Failed to save payment method");
            return null;
          }
          return null;
        })
        .then((settingsResult) => {
          if (settingsResult?.success && settingsResult.data) {
            setSettings(settingsResult.data);
            const team = teams.find((t) => t.id === teamId);
            const minCents = team?.companyId
              ? COMPANY_STUDY_COST_CENTS
              : PERSONAL_STUDY_COST_CENTS;
            const newThreshold =
              settingsResult.data.autoRefillThreshold ?? minCents;
            const newAmount = settingsResult.data.autoRefillAmount ?? minCents;
            setThresholdDollars((newThreshold / 100).toFixed(2));
            setAmountDollars((newAmount / 100).toFixed(2));
          }
        })
        .catch(() => {
          toast.error("Failed to process payment setup");
        })
        .finally(() => {
          setProcessingCheckout(false);
        });
    }
  }, [searchParams, router, teams]);

  // Load settings when team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setSettings(null);
      return;
    }

    const team = teams.find((t) => t.id === selectedTeamId);
    const minCents = team?.companyId
      ? COMPANY_STUDY_COST_CENTS
      : PERSONAL_STUDY_COST_CENTS;

    setLoading(true);
    getAutoRefillSettings(selectedTeamId)
      .then((result) => {
        if (result.success && result.data) {
          setSettings(result.data);
          const newThreshold = result.data.autoRefillThreshold ?? minCents;
          const newAmount = result.data.autoRefillAmount ?? minCents;
          setThresholdDollars((newThreshold / 100).toFixed(2));
          setAmountDollars((newAmount / 100).toFixed(2));
        } else if (!result.success) {
          toast.error(result.error);
        }
      })
      .catch(() => {
        toast.error("Failed to load auto-refill settings");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedTeamId, teams]);

  const handleSaveSettings = useCallback(async () => {
    if (!selectedTeamId) return;

    setIsPending(true);
    try {
      const result = await updateAutoRefillSettings({
        teamId: selectedTeamId,
        autoRefillEnabled: true,
        autoRefillThreshold: threshold,
        autoRefillAmount: amount,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to enable auto-refill");
        return;
      }

      toast.success("Auto-refill enabled");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              autoRefillEnabled: true,
              autoRefillThreshold: threshold,
              autoRefillAmount: amount,
            }
          : null,
      );
    } finally {
      setIsPending(false);
    }
  }, [selectedTeamId, threshold, amount]);

  const handleDisableAutoRefill = useCallback(async () => {
    if (!selectedTeamId) return;

    setIsPending(true);
    try {
      const result = await updateAutoRefillSettings({
        teamId: selectedTeamId,
        autoRefillEnabled: false,
        autoRefillThreshold: threshold,
        autoRefillAmount: amount,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to disable auto-refill");
        return;
      }

      toast.success("Auto-refill disabled");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              autoRefillEnabled: false,
            }
          : null,
      );
    } finally {
      setIsPending(false);
    }
  }, [selectedTeamId, threshold, amount]);

  const handleUpdateSettings = useCallback(async () => {
    if (!selectedTeamId) return;

    setIsPending(true);
    try {
      const result = await updateAutoRefillSettings({
        teamId: selectedTeamId,
        autoRefillEnabled: true,
        autoRefillThreshold: threshold,
        autoRefillAmount: amount,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to update auto-refill settings");
        return;
      }

      toast.success("Auto-refill settings updated");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              autoRefillThreshold: threshold,
              autoRefillAmount: amount,
            }
          : null,
      );
    } finally {
      setIsPending(false);
    }
  }, [selectedTeamId, threshold, amount]);

  const handleSetupPayment = useCallback(async () => {
    if (!selectedTeamId) return;

    setIsPaymentPending(true);
    try {
      const result = await createCheckoutSessionForPaymentSetup(selectedTeamId);

      if (!result.success || !result.data?.checkoutUrl) {
        toast.error(
          result.success
            ? "Failed to get checkout URL"
            : result.error || "Failed to initialize payment setup",
        );
        return;
      }

      window.location.href = result.data.checkoutUrl;
    } finally {
      setIsPaymentPending(false);
    }
  }, [selectedTeamId]);

  const handleRemovePaymentMethod = useCallback(async () => {
    if (!selectedTeamId) return;

    setIsPending(true);
    try {
      const result = await removePaymentMethod(selectedTeamId);

      if (!result.success) {
        toast.error(result.error || "Failed to remove payment method");
        return;
      }

      toast.success("Payment method removed and auto-refill disabled");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              paymentMethodLast4: null,
              paymentMethodBrand: null,
              autoRefillEnabled: false,
            }
          : null,
      );
    } finally {
      setIsPending(false);
    }
  }, [selectedTeamId]);

  const handleTeamSelect = useCallback(
    (teamId: string) => {
      setSelectedTeamId(teamId);
      if (teamId) {
        const team = teams.find((t) => t.id === teamId);
        const min = team?.companyId
          ? COMPANY_STUDY_COST_CENTS
          : PERSONAL_STUDY_COST_CENTS;
        setThresholdDollars((min / 100).toFixed(2));
        setAmountDollars((min / 100).toFixed(2));
      }
    },
    [teams],
  );

  const handleThresholdChange = useCallback((value: string) => {
    setThresholdDollars(value);
  }, []);

  const handleThresholdBlur = useCallback(() => {
    const parsed = parseFloat(thresholdDollars);
    if (Number.isFinite(parsed) && parsed > 0) {
      setThresholdDollars(parsed.toFixed(2));
    }
  }, [thresholdDollars]);

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
    <div>
      {/* Row 1: Team selector and threshold/amount */}
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-stretch">
        {/* Team Selection */}
        <div className="flex flex-1 flex-col justify-between">
          <Label htmlFor="team" className="mb-3 block">
            Which team do you want to set up auto-refills?
          </Label>
          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeamId}
            onTeamSelect={handleTeamSelect}
            disabled={isPending}
          />
        </div>

        {/* Threshold Selection */}
        <div className="flex flex-col justify-between">
          <Label htmlFor="threshold-input" className="mb-3 block">
            When to refill?
          </Label>
          <div className="flex items-center gap-2">
            <DollarInput
              id="threshold-input"
              value={thresholdDollars}
              onChange={handleThresholdChange}
              onBlur={handleThresholdBlur}
              disabled={isPending || loading}
            />
            <p className="text-muted-foreground text-xs text-zinc-500">
              remaining.
            </p>
          </div>
        </div>

        {/* Amount Selection */}
        <div className="flex flex-col justify-between">
          <Label htmlFor="amount-input" className="mb-3 block">
            How much do you want to add?
          </Label>
          <div className="flex items-center gap-2">
            <DollarInput
              id="amount-input"
              value={amountDollars}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              disabled={isPending || loading}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Cost summary, payment method, and actions */}
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Cost summary */}
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-sm">Total</span>
          <span className="text-2xl font-semibold tracking-tight">
            ${estimatedCost}
          </span>
        </div>

        {/* Right side: Payment method and Enable/Disable button */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : hasPaymentMethod ? (
            <PaymentMethodDisplay
              settings={settings}
              onUpdate={handleSetupPayment}
              onRemove={handleRemovePaymentMethod}
              isPaymentPending={isPaymentPending}
              isPending={isPending}
              disabled={!selectedTeamId}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetupPayment}
              disabled={isPaymentPending || !selectedTeamId}
            >
              {isPaymentPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Add Payment Method
            </Button>
          )}

          {isAutoRefillActive ? (
            <div className="flex items-center gap-3">
              {hasChanges && (
                <Button
                  onClick={handleUpdateSettings}
                  disabled={
                    isPending ||
                    loading ||
                    !selectedTeamId ||
                    amount < minRefillAmountCents
                  }
                >
                  Update Auto-Refill
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleDisableAutoRefill}
                disabled={isPending || loading || !selectedTeamId}
              >
                Disable
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSaveSettings}
              disabled={
                isPending ||
                loading ||
                !selectedTeamId ||
                !hasPaymentMethod ||
                amount < minRefillAmountCents
              }
            >
              Enable
            </Button>
          )}
        </div>
      </div>

      {selectedTeamId && amount < minRefillAmountCents && (
        <p className="text-right text-xs text-red-500">
          Minimum refill amount is ${minRefillDollars}
        </p>
      )}

      {/* Processing checkout indicator */}
      {processingCheckout && (
        <div className="bg-muted/50 fixed inset-0 z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-lg bg-white p-6 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing payment setup...</span>
          </div>
        </div>
      )}
    </div>
  );
}
