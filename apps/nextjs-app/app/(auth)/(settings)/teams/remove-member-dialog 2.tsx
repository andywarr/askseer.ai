"use client";

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
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>
            {removeTarget
              ? `This will remove ${
                  removeTarget.user.name || removeTarget.user.email
                } from this team.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={removePending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={removePending}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
