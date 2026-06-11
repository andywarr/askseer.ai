"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { toast } from "sonner";
import { createTeam } from "@/apps/nextjs-app/lib/db/data";
import type { CompanyMember } from "./types";
import { MemberSelector, type MemberRole } from "./member-selector";
import { getCreateTeamSchema } from "./schemas";

interface CreateTeamDialogProps {
  companyId: string;
  currentUserId: string;
  companyMembers: CompanyMember[];
}

export function CreateTeamDialog({
  companyId,
  currentUserId,
  companyMembers,
}: CreateTeamDialogProps) {
  const router = useRouter();
  const t = useTranslations("TeamsSettings");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [memberRoles, setMemberRoles] = useState<Record<string, MemberRole>>({});
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const membersToAdd = Object.entries(memberRoles).map(([userId, role]) => {
      const email = companyMembers.find((mem) => mem.userId === userId)?.user.email;
      return { userId, role, email };
    });

    const validation = getCreateTeamSchema(t).safeParse({
      name: teamName,
      members: membersToAdd,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        await createTeam(
          companyId,
          currentUserId,
          validation.data.name,
          membersToAdd
        );
        toast.success(t("teamCreated"));
        setDialogOpen(false);
        setTeamName("");
        setMemberRoles({});
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("failedToCreateTeam");
        toast.error(message);
      }
    });
  };

  const handleAddMember = (userId: string, role: MemberRole) => {
    setMemberRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const handleRemoveMember = (userId: string) => {
    setMemberRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const handleRoleChange = (userId: string, role: MemberRole) => {
    setMemberRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTeamName("");
      setMemberRoles({});
    }
  };

  const isNameValid = teamName.trim().length >= 3;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">{t("createTeamBtn")}</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("createTeamTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} aria-label={t("selectTeamMembersAria")}>
          <div className="mb-4">
            <label htmlFor="team-name" className="sr-only">
              {t("teamNameLabel")}
            </label>
            <Input
              id="team-name"
              autoFocus
              placeholder={t("teamNamePlaceholder")}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={50}
              aria-required="true"
              aria-invalid={teamName.length > 0 && !isNameValid}
            />
          </div>

          <MemberSelector
            availableMembers={companyMembers}
            selectedMembers={memberRoles}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onRoleChange={handleRoleChange}
            disabled={pending || !isNameValid}
            addFirstLabel={t("addMember")}
            addAnotherLabel={t("addAnotherMember")}
            ariaLabel={t("selectTeamMembersAria")}
          />

          <Button type="submit" disabled={pending || !isNameValid}>
            {pending ? t("creating") : t("createBtn")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
