"use client";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import type { Member } from "./types";

interface DeactivateMemberDialogProps {
  target: Member | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateMemberDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: DeactivateMemberDialogProps) {
  const t = useTranslations("CompanySettings");
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("deactivateMemberTitle")}</DialogTitle>
          <DialogDescription>
            {target
              ? t("deactivateMemberDesc", {
                  name: target.user.name || target.user.email,
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("cancelBtn")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {t("deactivateOption")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ActivateMemberDialogProps {
  target: Member | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ActivateMemberDialog({
  target,
  pending,
  onClose,
  onConfirm,
}: ActivateMemberDialogProps) {
  const t = useTranslations("CompanySettings");
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("activateMemberTitle")}</DialogTitle>
          <DialogDescription>
            {target
              ? t("activateMemberDesc", {
                  name: target.user.name || target.user.email,
                })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("cancelBtn")}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {t("activateOption")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EraseMemberDialogProps {
  target: Member | null;
  pending: boolean;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function EraseMemberDialog({
  target,
  pending,
  confirmation,
  onConfirmationChange,
  onClose,
  onConfirm,
}: EraseMemberDialogProps) {
  const t = useTranslations("CompanySettings");
  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("deleteMemberPermanentlyTitle")}</DialogTitle>
          <DialogDescription>
            {target ? (
              <span>
                {t.rich("deleteMemberPermanentlyDesc", {
                  name: target.user.name || target.user.email,
                  bold: (chunks) => (
                    <span className="font-semibold">{chunks}</span>
                  ),
                })}
              </span>
            ) : (
              ""
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="erase-confirmation" className="text-sm font-medium">
              {t.rich("typeDeleteToConfirm", {
                bold: (chunks) => (
                  <span className="font-mono font-bold">{chunks}</span>
                ),
              })}
            </label>
            <Input
              id="erase-confirmation"
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              placeholder={t("deletePhrase")}
              disabled={pending}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("cancelBtn")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending || confirmation !== "delete"}
          >
            {t("permanentlyDeleteBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
