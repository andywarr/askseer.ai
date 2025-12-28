"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

import { createCompanyForMyDomain } from "@/apps/nextjs-app/lib/data";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";

export type ClaimCompanyDialogMode = "create" | "pending";

interface ClaimCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ClaimCompanyDialogMode;
  domain?: string | null;
}

export function ClaimCompanyDialog({
  open,
  onOpenChange,
  mode,
  domain,
}: ClaimCompanyDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [claimSubmitting, startClaimTransition] = useTransition();

  const submitClaim = () => {
    if (!authorized) return;
    startClaimTransition(async () => {
      try {
        const res = await createCompanyForMyDomain(
          companyName.trim() || undefined,
        );
        if ((res as any)?.success) {
          toast.success("Company claim submitted");
          onOpenChange(false);
        } else {
          toast.error("Failed to submit claim");
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to submit claim");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === "create" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <Building2 className="h-5 w-5" /> Claim your company
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="claim-company-name"
                  className="leading-7 tracking-tight text-zinc-500"
                >
                  What is your company&apos;s name?
                </label>
                <Input
                  id="claim-company-name"
                  placeholder="e.g. Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-10"
                />
                {domain && (
                  <p className="mt-1 text-xs text-zinc-500">
                    We&apos;ll associate {domain} with this company.
                  </p>
                )}
              </div>
              <div className="my-4 flex items-start gap-2">
                <input
                  id="claim-auth"
                  type="checkbox"
                  className="peer mt-1 h-4 w-4 rounded border border-zinc-300 text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                <label
                  htmlFor="claim-auth"
                  className="text-xs leading-5 text-zinc-600 peer-disabled:cursor-not-allowed"
                >
                  I am authorized to claim this company and verify ownership
                  of this email domain.
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={claimSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitClaim}
                  disabled={!authorized || claimSubmitting}
                >
                  Claim
                </Button>
              </div>
            </div>
          </>
        )}
        {mode === "pending" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <Building2 className="h-5 w-5" /> Company claim under review
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm leading-6 tracking-tight">
              <p className="leading-7 [&:not(:first-child)]:mt-6">
                We are verifying your domain ownership. You can continue using
                Seer while we review.
              </p>
              <p className="leading-7 [&:not(:first-child)]:mt-6">
                Questions? Contact{" "}
                <a
                  href="mailto:teams@askseer.ai"
                  className="font-medium underline underline-offset-2"
                >
                  teams@askseer.ai
                </a>
                .
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
