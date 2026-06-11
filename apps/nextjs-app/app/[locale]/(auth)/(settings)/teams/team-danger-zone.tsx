"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

export function TeamDangerZone({
  team,
  canDelete,
  onDeleted,
}: TeamDangerZoneProps) {
  const router = useRouter();
  const t = useTranslations("TeamsSettings");
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteStudiesConfirmed, setDeleteStudiesConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  const deleteConfirmationPhrase = t("deleteConfirmationPhrase");

  const hasStudies = team.studyCount > 0;
  const hasMembers = team.memberCount > 0;
  const hasBalance = team.balanceCents > 0;
  const confirmationMatches =
    confirmation.trim().toLowerCase() === deleteConfirmationPhrase.toLowerCase();
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
        toast.success(t("teamDeletedSuccess", { name: team.name }));
        setOpen(false);
        onDeleted();
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message || t("failedToDeleteTeam"));
      }
    });
  };

  return (
    <section className="group mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("advancedTitle")}
        </h3>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            {t("deleteTeamTitle")}
          </h4>
          <p className="text-sm">
            {t.rich("deleteTeamDescription", {
              name: team.name,
              hasStudies: String(hasStudies),
              hasMembers: String(hasMembers),
              bold: (chunks) => <strong>{chunks}</strong>,
            })}
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
              {t("deleteBtn")}
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>
                {t("deleteTeamDialogTitle", { name: team.name })}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    {t.rich("deleteTeamDialogDescription", {
                      name: team.name,
                      hasStudies: String(hasStudies),
                      hasMembers: String(hasMembers),
                      hasBalance: String(hasBalance),
                      bold: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            {hasStudies && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t.rich("hasStudiesWarning", {
                    count: team.studyCount,
                    bold: (chunks) => <strong>{chunks}</strong>,
                  })}
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
                    {t("deleteStudiesLabel", { count: team.studyCount })}
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("confirmPrompt", { phrase: deleteConfirmationPhrase })}
              </label>
              <Input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={deleteConfirmationPhrase}
                disabled={pending}
              />
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!canSubmit || pending}
                onClick={handleDelete}
              >
                {pending ? t("deleting") : t("permanentlyDelete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
