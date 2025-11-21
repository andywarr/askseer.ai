"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { deleteCompany } from "@/apps/nextjs-app/lib/data";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmationPhrase = "permanently delete";
  const confirmationMatches =
    confirmation.trim().toLowerCase() === confirmationPhrase;

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteCompany(companyId);
        toast.success("Company deleted");
        setOpen(false);
        router.push("/");
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete company");
      }
    });
  };

  return (
    <section className="mt-10 rounded-lg border border-red-200 bg-red-50 px-6 py-5 text-red-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
            Advanced
          </p>
          <h3 className="text-xl font-semibold">Danger zone</h3>
          <p className="text-sm text-red-800">
            Delete {companyName} and all teams, memberships, studies, and related
            files. This action cannot be undone.
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
              Delete company
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>Delete company</DialogTitle>
              <DialogDescription className="space-y-2 text-red-800">
                <p>
                  This will permanently delete {companyName}, all associated
                  teams, memberships, studies, and their files. Team members will
                  lose access immediately.
                </p>
                <p className="font-semibold">
                  This action cannot be undone.
                </p>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-900">
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
