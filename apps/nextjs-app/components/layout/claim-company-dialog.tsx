"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

import { createCompanyForMyDomain } from "@/apps/nextjs-app/lib/db/data";
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
  const t = useTranslations("ClaimCompanyDialog");
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
          toast.success(t("toastSuccess"));
          onOpenChange(false);
        } else {
          toast.error(t("toastError"));
        }
      } catch (e: any) {
        toast.error(e?.message || t("toastError"));
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
                <Building2 className="h-5 w-5" /> {t("claimTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="claim-company-name"
                  className="leading-7 tracking-tight text-zinc-500"
                >
                  {t("nameLabel")}
                </label>
                <Input
                  id="claim-company-name"
                  placeholder={t("placeholder")}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-10"
                />
                {domain && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("domainDisclaimer", { domain })}
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
                  {t("authorizeLabel")}
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={claimSubmitting}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={submitClaim}
                  disabled={!authorized || claimSubmitting}
                >
                  {t("claim")}
                </Button>
              </div>
            </div>
          </>
        )}
        {mode === "pending" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <Building2 className="h-5 w-5" /> {t("pendingTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm leading-6 tracking-tight">
              <p className="leading-7 [&:not(:first-child)]:mt-6">
                {t("pendingDescription")}
              </p>
              <p className="leading-7 [&:not(:first-child)]:mt-6">
                {t.rich("pendingQuestions", {
                  emailLink: (chunks) => (
                    <a
                      href="mailto:teams@askseer.ai"
                      className="font-medium underline underline-offset-2"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
