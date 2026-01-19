"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Input } from "@/apps/nextjs-app/components/ui/input";
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
} from "@/apps/nextjs-app/lib/actions/credit-actions";
import { TeamSelector, type Team } from "./team-selector";

type AutoRefillSettings = {
  autoRefillEnabled: boolean;
  autoRefillThreshold: number | null;
  autoRefillAmount: number | null;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
};

type AutoRefillFormProps = {
  teams: Team[];
  unitPrice: number;
};

const MAX_THRESHOLD = 100;
const MAX_AMOUNT = 1000;

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

export function AutoRefillForm({ teams, unitPrice }: AutoRefillFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [settings, setSettings] = useState<AutoRefillSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const hasProcessedCheckoutRef = useRef(false);

  // Form state
  const [threshold, setThreshold] = useState<number>(5);
  const [thresholdInput, setThresholdInput] = useState<string>("5");
  const [amount, setAmount] = useState<number>(0);
  const [amountInput, setAmountInput] = useState<string>("0");

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

  const estimatedCost = useMemo(
    () => (amount * unitPrice).toFixed(2),
    [amount, unitPrice],
  );

  // Handle return from Stripe Checkout
  useEffect(() => {
    const setupSuccess = searchParams.get("setup_success");
    const setupCancelled = searchParams.get("setup_cancelled");
    const teamId = searchParams.get("team");
    const sessionId = searchParams.get("session_id");

    if (setupCancelled && teamId) {
      toast.info("Payment setup was cancelled");
      router.replace("/credits", { scroll: false });
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

      router.replace("/credits", { scroll: false });

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
            const newThreshold = settingsResult.data.autoRefillThreshold ?? 5;
            const newAmount = settingsResult.data.autoRefillAmount ?? 20;
            setThreshold(newThreshold);
            setThresholdInput(newThreshold.toString());
            setAmount(newAmount);
            setAmountInput(newAmount.toString());
          }
        })
        .catch(() => {
          toast.error("Failed to process payment setup");
        })
        .finally(() => {
          setProcessingCheckout(false);
        });
    }
  }, [searchParams, router]);

  // Load settings when team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setSettings(null);
      return;
    }

    setLoading(true);
    getAutoRefillSettings(selectedTeamId)
      .then((result) => {
        if (result.success && result.data) {
          setSettings(result.data);
          const newThreshold = result.data.autoRefillThreshold ?? 10;
          const newAmount = result.data.autoRefillAmount ?? 0;
          setThreshold(newThreshold);
          setThresholdInput(newThreshold.toString());
          setAmount(newAmount);
          setAmountInput(newAmount.toString());
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
  }, [selectedTeamId]);

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

  const handleTeamSelect = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  const handleThresholdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue = Number(value);
      if (numValue > MAX_THRESHOLD) {
        setThresholdInput(MAX_THRESHOLD.toString());
        setThreshold(MAX_THRESHOLD);
      } else {
        setThresholdInput(value);
        setThreshold(numValue || 1);
      }
    },
    [],
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue = Number(value);
      if (numValue > MAX_AMOUNT) {
        setAmountInput(MAX_AMOUNT.toString());
        setAmount(MAX_AMOUNT);
      } else {
        setAmountInput(value);
        setAmount(numValue || 1);
      }
    },
    [],
  );

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
            <Input
              id="threshold-input"
              type="number"
              min={1}
              max={MAX_THRESHOLD}
              value={thresholdInput}
              onChange={handleThresholdChange}
              disabled={isPending || loading}
              className="text-center"
              style={{ width: `${Math.max(thresholdInput.length + 7, 8)}ch` }}
            />
            <p className="text-muted-foreground text-xs text-zinc-500">
              Credits remain.
            </p>
          </div>
        </div>

        {/* Amount Selection */}
        <div className="flex flex-col justify-between">
          <Label htmlFor="amount-input" className="mb-3 block">
            How many credits do you want to purchase?
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="amount-input"
              type="number"
              min={1}
              max={MAX_AMOUNT}
              value={amountInput}
              onChange={handleAmountChange}
              disabled={isPending || loading}
              className="text-center"
              style={{ width: `${Math.max(amountInput.length + 7, 8)}ch` }}
            />
            <p className="text-muted-foreground text-xs text-zinc-500">
              Each credit costs{" "}
              {unitPrice.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              .
            </p>
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
            <>
              {hasChanges && (
                <Button
                  onClick={handleUpdateSettings}
                  disabled={
                    isPending || loading || !selectedTeamId || amount < 1
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
            </>
          ) : (
            <Button
              onClick={handleSaveSettings}
              disabled={
                isPending ||
                loading ||
                !selectedTeamId ||
                !hasPaymentMethod ||
                amount < 1
              }
            >
              Enable
            </Button>
          )}
        </div>
      </div>

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
