"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { deleteCompany } from "@/apps/nextjs-app/lib/db/data";
import { signOutServerAction } from "@/apps/nextjs-app/lib/actions/auth-actions";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";

interface CompanyDangerZoneProps {
  companyId: string;
  companyName: string;
  canDelete: boolean;
}

export default function CompanyDangerZone({
  companyId,
  companyName,
  canDelete,
}: CompanyDangerZoneProps) {
  const t = useTranslations("CompanySettings");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmationPhrase = t("confirmationPhrase");
  const confirmationMatches =
    confirmation.trim().toLowerCase() === confirmationPhrase.toLowerCase();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteCompany(companyId);
        toast.success(t("companyDeleted"));
        setOpen(false);
        // Sign out the user since their account was deleted along with the company
        await signOutServerAction();
      } catch (error: any) {
        toast.error(error?.message || t("failedToDeleteCompany"));
      }
    });
  };

  return (
    <section className="group mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("advancedHeader")}
        </h3>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            {t("deleteCompanyHeader")}
          </h4>
          <p className="text-sm">
            {t("deleteCompanyDesc", { companyName })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={!canDelete}
              className="w-full md:w-auto"
            >
              <AlertTriangle className="size-4" />
              {t("deleteBtn")}
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>{t("deleteCompanyHeader")}</DialogTitle>
              <DialogDescription className="text-black-500 space-y-2">
                <span>
                  {t("deleteCompanyDialogDesc", { companyName })}
                </span>
                <span className="mt-2 block font-semibold">
                  {t("actionCannotBeUndone")}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("confirmPhrasePrompt", { phrase: confirmationPhrase })}
              </label>
              <Input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={confirmationPhrase}
                disabled={pending}
              />
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmation("");
                  setOpen(false);
                }}
                disabled={pending}
              >
                {t("cancelBtn")}
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmationMatches || pending}
                onClick={handleDelete}
              >
                {pending ? t("deletingBtn") : t("permanentlyDeleteBtn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
