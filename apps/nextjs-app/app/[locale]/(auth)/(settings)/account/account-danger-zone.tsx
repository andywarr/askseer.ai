"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { deleteUserAccount } from "@/apps/nextjs-app/lib/db/data";
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

interface AccountDangerZoneProps {
  userId: string;
}

export default function AccountDangerZone({ userId }: AccountDangerZoneProps) {
  const t = useTranslations("AccountSettings");
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmationPhrase = t("dangerZone.confirmationPhrase");
  const confirmationMatches =
    confirmation.trim().toLowerCase() === confirmationPhrase.toLowerCase();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteUserAccount(userId);
        toast.success(t("dangerZone.toastSuccess"));
        setOpen(false);
        await signOutServerAction();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : t("dangerZone.toastErrorFallback");
        toast.error(message);
      }
    });
  };

  return (
    <section className="group mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("dangerZone.title")}
        </h3>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            {t("dangerZone.deleteAccount")}
          </h4>
          <p className="text-sm">
            {t("dangerZone.deleteDescription")}
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) setConfirmation("");
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full md:w-auto"
              disabled={pending}
            >
              <AlertTriangle className="size-4" />
              {t("dangerZone.deleteButton")}
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>{t("dangerZone.deleteAccount")}</DialogTitle>
              <DialogDescription className="text-black-500 space-y-2">
                <span>
                  {t("dangerZone.dialogDescription1")}
                </span>
                <span className="mt-2 block font-semibold">
                  {t("dangerZone.dialogDescription2")}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("dangerZone.confirmPrompt", { phrase: confirmationPhrase })}
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
                {t("dangerZone.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmationMatches || pending}
                onClick={handleDelete}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? t("dangerZone.deleting") : t("dangerZone.permanentlyDelete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
