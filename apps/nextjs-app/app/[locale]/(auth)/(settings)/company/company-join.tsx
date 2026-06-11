"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  updateCompanyAutoEnroll,
  updateCompanyPersonalTeams,
} from "@/apps/nextjs-app/lib/db/data";
import PotentialMembers from "./suggested-members";
import type { DomainUser } from "./types";



interface Props {
  companyId: string;
  domain: string;
  autoEnroll: boolean;
  personalTeamsDisabled: boolean;
  isOwner: boolean;
  domainUsers: DomainUser[];
}

export default function CompanyJoin({
  companyId,
  domain,
  autoEnroll,
  personalTeamsDisabled,
  isOwner,
  domainUsers,
}: Props) {
  const t = useTranslations("CompanySettings");
  const [auto, setAuto] = useState(autoEnroll);
  const [personalDisabled, setPersonalDisabled] = useState(
    personalTeamsDisabled,
  );
  const [pending, startTransition] = useTransition();
  const domainArticle = /^[aeiou]/i.test(domain?.[0] ?? "") ? "an" : "a";

  const handleToggle = (checked: boolean) => {
    setAuto(checked);
    startTransition(async () => {
      try {
        await updateCompanyAutoEnroll(companyId, checked);
        toast.success(t("joinSettingsUpdated"));
      } catch (e: any) {
        toast.error(e?.message || t("failedToUpdateJoinSettings"));
        setAuto(!checked);
      }
    });
  };

  const handlePersonalToggle = (checked: boolean) => {
    setPersonalDisabled(checked);
    startTransition(async () => {
      try {
        await updateCompanyPersonalTeams(companyId, checked);
        toast.success(t("personalTeamAccessUpdated"));
      } catch (e: any) {
        toast.error(
          e?.message || t("failedToUpdatePersonalTeams"),
        );
        setPersonalDisabled(!checked);
      }
    });
  };

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("joinHeader")}
        </h3>
      </div>
      <div className="space-y-4 text-sm leading-7 tracking-tight">
        <div className="mb-4 flex items-center gap-2">
          <Checkbox
            id="auto-enroll"
            checked={auto}
            disabled={!isOwner || pending}
            onCheckedChange={(checked: boolean) => handleToggle(!!checked)}
          />
          <label htmlFor="auto-enroll" className="text-sm text-zinc-700">
            {t("autoEnrollLabel", { domainArticle, domain })}
          </label>
        </div>
        <PotentialMembers
          companyId={companyId}
          domain={domain}
          users={domainUsers}
          isOwner={isOwner}
        />
      </div>
      <div className="mt-8 text-sm leading-7 tracking-tight">
        <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("personalTeamsHeader")}
        </h3>
        <div className="flex items-center gap-2">
          <Checkbox
            id="disable-personal-teams"
            checked={personalDisabled}
            disabled={!isOwner || pending}
            onCheckedChange={(checked: boolean) =>
              handlePersonalToggle(!!checked)
            }
          />
          <label
            htmlFor="disable-personal-teams"
            className="text-sm text-zinc-700"
          >
            {t("disablePersonalTeamsLabel")}
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {t("disablePersonalTeamsDesc")}
        </p>
      </div>
    </section>
  );
}
