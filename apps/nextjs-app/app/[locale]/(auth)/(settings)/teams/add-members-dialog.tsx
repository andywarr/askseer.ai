"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { toast } from "sonner";
import { addMembersToTeam } from "@/apps/nextjs-app/lib/db/data";
import type { Team, CompanyMember } from "./types";
import { MemberSelector, type MemberRole } from "./member-selector";
import { getAddMembersSchema } from "./schemas";

interface AddMembersDialogProps {
  team: Team;
  companyMembers: CompanyMember[];
  canInvite: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMembersDialog({
  team,
  companyMembers,
  canInvite,
  open,
  onOpenChange,
}: AddMembersDialogProps) {
  const router = useRouter();
  const t = useTranslations("TeamsSettings");
  const [inviteMembers, setInviteMembers] = useState<Record<string, MemberRole>>({});
  const [invitePending, startInviteTransition] = useTransition();

  const availableMembers = useMemo(() => {
    const existingIds = new Set(
      (team.members || []).map((member) => member.userId)
    );
    return companyMembers.filter((member) => !existingIds.has(member.userId));
  }, [team, companyMembers]);

  const inviteButtonDisabled =
    team.isPersonal || availableMembers.length === 0 || !canInvite;

  const inviteButtonTitle = (() => {
    if (team.isPersonal) {
      return t("personalTeamsCantInvite");
    }
    if (!canInvite) {
      return t("needTeamAdminToInvite");
    }
    if (availableMembers.length === 0) {
      return t("allMembersAlreadyInTeam");
    }
    return undefined;
  })();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setInviteMembers({});
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const membersToInvite = Object.entries(inviteMembers).map(
      ([userId, role]) => {
        const member = companyMembers.find((m) => m.userId === userId);
        return {
          userId,
          role,
          email: member?.user.email,
        };
      }
    );

    // Validate with Zod
    const validation = getAddMembersSchema(t).safeParse({
      teamId: team.id,
      teamName: team.name,
      members: membersToInvite,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    startInviteTransition(async () => {
      try {
        await addMembersToTeam(team.id, team.name, membersToInvite);
        handleOpenChange(false);
        router.refresh();
        toast.success(t("membersAddedSuccess"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("failedToAddMembers");
        toast.error(message);
      }
    });
  };

  const handleAddMember = (userId: string, role: MemberRole) => {
    setInviteMembers((prev) => ({ ...prev, [userId]: role }));
  };

  const handleRemoveMember = (userId: string) => {
    setInviteMembers((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const handleRoleChange = (userId: string, role: MemberRole) => {
    setInviteMembers((prev) => ({ ...prev, [userId]: role }));
  };

  const hasSelectedMembers = Object.keys(inviteMembers).length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={inviteButtonDisabled}
                aria-label={t("addMembersToTeam", { name: team.name })}
              >
                {t("addTeamMembersBtn")}
              </Button>
            </DialogTrigger>
          </span>
        </TooltipTrigger>
        {inviteButtonDisabled && inviteButtonTitle && (
          <TooltipContent>
            <p>{inviteButtonTitle}</p>
          </TooltipContent>
        )}
      </Tooltip>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("addMembersToTeam", { name: team.name })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} aria-label={t("addMembersToTeam", { name: team.name })}>
          <MemberSelector
            availableMembers={availableMembers}
            selectedMembers={inviteMembers}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onRoleChange={handleRoleChange}
            disabled={invitePending}
            searchPlaceholder={t("searchCompanyMembersPlaceholder")}
            addFirstLabel={t("addMember")}
            addAnotherLabel={t("addAnotherMember")}
            ariaLabel={t("selectMembersToAddAria")}
          />

          <Button type="submit" disabled={invitePending || !hasSelectedMembers}>
            {invitePending ? t("adding") : t("addMembersBtn")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
