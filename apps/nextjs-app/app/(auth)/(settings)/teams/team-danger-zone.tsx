"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { deleteTeam } from "@/apps/nextjs-app/lib/db/data";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
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
import type { Team } from "./types";

interface TeamDangerZoneProps {
  team: Team;
  canDelete: boolean;
  onDeleted: () => void;
}

const CONFIRMATION_PHRASE = "permanently delete";

export function TeamDangerZone({
  team,
  canDelete,
  onDeleted,
}: TeamDangerZoneProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteStudiesConfirmed, setDeleteStudiesConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasStudies = team.studyCount > 0;
  const hasMembers = team.memberCount > 0;
  const confirmationMatches =
    confirmation.trim().toLowerCase() === CONFIRMATION_PHRASE;
  const canSubmit =
    confirmationMatches && (!hasStudies || deleteStudiesConfirmed);

  const handleOpenChange = (next: boolean) => {
    if (!pending) {
      setOpen(next);
      if (!next) {
        setConfirmation("");
        setDeleteStudiesConfirmed(false);
      }
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteTeam(team.id, hasStudies && deleteStudiesConfirmed);
        toast.success(`"${team.name}" has been deleted`);
        setOpen(false);
        onDeleted();
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete team");
      }
    });
  };

  return (
    <section className="group mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Advanced
        </h3>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            Delete team
          </h4>
          <p className="text-sm">
            Permanently delete <strong>{team.name}</strong>
            {hasStudies ? ", its studies," : ""}
            {hasMembers ? " and remove its members" : ""}. This action cannot be
            undone.
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={!canDelete}
              className="w-full md:w-auto"
            >
              <AlertTriangle className="size-4" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{team.name}&rdquo;</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    This will permanently delete <strong>{team.name}</strong>
                    {hasStudies ? ", its studies," : ""}
                    {hasMembers ? " and remove its members" : ""}. This action
                    cannot be undone.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            {hasStudies && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-300">
                  This team has{" "}
                  <strong>
                    {team.studyCount}{" "}
                    {team.studyCount === 1 ? "study" : "studies"}
                  </strong>
                  . Transfer them to another team first, or check the box below
                  to permanently delete them along with the team.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="delete-studies"
                    checked={deleteStudiesConfirmed}
                    onCheckedChange={(checked) =>
                      setDeleteStudiesConfirmed(Boolean(checked))
                    }
                    disabled={pending}
                  />
                  <label
                    htmlFor="delete-studies"
                    className="text-sm font-medium text-amber-900 dark:text-amber-200"
                  >
                    Also delete all {team.studyCount}{" "}
                    {team.studyCount === 1 ? "study" : "studies"} in this team
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Type &ldquo;{CONFIRMATION_PHRASE}&rdquo; to confirm.
              </label>
              <Input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                disabled={pending}
              />
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canSubmit || pending}
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
