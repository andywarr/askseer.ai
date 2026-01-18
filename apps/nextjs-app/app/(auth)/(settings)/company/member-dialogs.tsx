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
          <DialogTitle>Deactivate member</DialogTitle>
          <DialogDescription>
            {target
              ? `This will deactivate ${
                  target.user.name || target.user.email
                } from the company. Their past work will remain available.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            Deactivate
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
          <DialogTitle>Activate member</DialogTitle>
          <DialogDescription>
            {target
              ? `This will reactivate ${
                  target.user.name || target.user.email
                } and restore their access to the company. They will be automatically added to any teams with an auto-join policy.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            Activate
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
          <DialogTitle>Delete member permanently</DialogTitle>
          <DialogDescription>
            {target ? (
              <span>
                This will permanently delete{" "}
                <span className="font-semibold">
                  {target.user.name || target.user.email}
                </span>
                . This action cannot be undone. Their past work will remain
                available but will show as created by &quot;Deleted User&quot;.
              </span>
            ) : (
              ""
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="erase-confirmation" className="text-sm font-medium">
              Type <span className="font-mono font-bold">delete</span> to
              confirm
            </label>
            <Input
              id="erase-confirmation"
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              placeholder="delete"
              disabled={pending}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={pending || confirmation !== "delete"}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
