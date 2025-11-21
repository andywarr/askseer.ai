"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { deleteUserAccount } from "@/apps/nextjs-app/lib/data";
import { signOutServerAction } from "@/apps/nextjs-app/lib/action";
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
  userDisplayName: string;
}

export default function AccountDangerZone({
  userId,
  userDisplayName,
}: AccountDangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmationPhrase = "delete my account";
  const confirmationMatches =
    confirmation.trim().toLowerCase() === confirmationPhrase;
  const safeDisplayName = userDisplayName?.trim() || "your";
  const possessiveName =
    safeDisplayName.toLowerCase() === "your"
      ? "your"
      : `${safeDisplayName}'s`;

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteUserAccount(userId);
        toast.success("Account deleted");
        setOpen(false);
        await signOutServerAction();
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete account");
      }
    });
  };

  return (
    <section className="group mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Danger Zone
        </h3>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            Delete account
          </h4>
          <p className="text-sm">
            Delete {possessiveName} account, their personal team, studies, and
            related files. This action cannot be undone.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full md:w-auto"
              disabled={pending}
            >
              <AlertTriangle className="size-4" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>Delete account</DialogTitle>
              <DialogDescription className="text-black-500 space-y-2">
                <span>
                  This will permanently delete your user account, your personal
                  team, studies, and related files.
                </span>
                <span className="mt-2 block font-semibold">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type &ldquo;{confirmationPhrase}&rdquo; to confirm.
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
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmationMatches || pending}
                onClick={handleDelete}
              >
                {pending ? "Deleting..." : "Permanently delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
