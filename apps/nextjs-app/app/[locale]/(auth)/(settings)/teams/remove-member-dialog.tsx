"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import type { TeamMember } from "./types";

interface RemoveMemberDialogProps {
  removeTarget: TeamMember | null;
  removePending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveMemberDialog({
  removeTarget,
  removePending,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  const t = useTranslations("TeamsSettings");

  return (
    <Dialog
      open={!!removeTarget}
      onOpenChange={(open) => {
        if (!open && !removePending) {
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("removeMemberTitle")}</DialogTitle>
          <DialogDescription>
            {removeTarget
              ? t("removeMemberConfirmDesc", {
                  name: removeTarget.user.name || removeTarget.user.email,
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={removePending}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={removePending}
          >
            {t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
