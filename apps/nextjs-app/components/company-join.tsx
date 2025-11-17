"use client";

import { useState, useTransition } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { toast } from "sonner";
import {
  updateCompanyAutoEnroll,
  enrollDomainUsers,
  updateCompanyPersonalTeams,
} from "@/apps/nextjs-app/lib/data";

interface DomainUser {
  id: string;
  name: string | null;
  email: string;
}

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
  const [auto, setAuto] = useState(autoEnroll);
  const [personalDisabled, setPersonalDisabled] = useState(
    personalTeamsDisabled,
  );
  const [users, setUsers] = useState(domainUsers);
  const [pending, startTransition] = useTransition();
  const domainArticle = /^[aeiou]/i.test(domain?.[0] ?? "") ? "an" : "a";

  const handleToggle = (checked: boolean) => {
    setAuto(checked);
    startTransition(async () => {
      try {
        await updateCompanyAutoEnroll(companyId, checked);
        toast.success("Join settings updated");
      } catch (e: any) {
        toast.error(e?.message || "Failed to update");
        setAuto(!checked);
      }
    });
  };

  const handleEnroll = () => {
    startTransition(async () => {
      try {
        await enrollDomainUsers(
          companyId,
          users.map((u) => u.id),
        );
        toast.success("Users enrolled");
        setUsers([]);
      } catch (e: any) {
        toast.error(e?.message || "Failed to enroll users");
      }
    });
  };

  const handlePersonalToggle = (checked: boolean) => {
    setPersonalDisabled(checked);
    startTransition(async () => {
      try {
        await updateCompanyPersonalTeams(companyId, checked);
        toast.success("Personal team access updated");
      } catch (e: any) {
        toast.error(
          e?.message || "Failed to update personal team availability",
        );
        setPersonalDisabled(!checked);
      }
    });
  };

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Join
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
            Automatically add users with {domainArticle} {domain} email address
          </label>
        </div>
        {users.length > 0 && (
          <div className="space-y-2">
            <p className="text-zinc-600">
              There {users.length === 1 ? "is" : "are"} {users.length} existing{" "}
              {users.length === 1 ? "user" : "users"} with {domainArticle}{" "}
              {domain} email address who {users.length === 1 ? "is" : "are"} not
              part of this company. Select the Enroll button below to add them.
            </p>
            <Button
              onClick={handleEnroll}
              disabled={!isOwner || pending}
              size="sm"
            >
              Enroll
            </Button>
          </div>
        )}
      </div>
      <div className="mt-8 border-t pt-6 text-sm leading-7 tracking-tight">
        <h4 className="mb-3 text-lg font-semibold">Personal teams</h4>
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
            Disable personal teams for company members
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          When disabled, members will need to use a company team instead of
          their personal team.
        </p>
      </div>
    </section>
  );
}
