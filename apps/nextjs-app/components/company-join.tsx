"use client";

import { useState, useTransition } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { toast } from "sonner";
import {
  updateCompanyAutoEnroll,
  enrollDomainUsers,
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
  isOwner: boolean;
  domainUsers: DomainUser[];
}

export default function CompanyJoin({
  companyId,
  domain,
  autoEnroll,
  isOwner,
  domainUsers,
}: Props) {
  const [auto, setAuto] = useState(autoEnroll);
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

  return (
    <section className="group mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Join
        </h3>
      </div>
      <div className="space-y-4 text-sm leading-7 tracking-tight">
        <div className="mb-4 flex items-center gap-2">
          <input
            id="auto-enroll"
            type="checkbox"
            className="h-4 w-4 rounded border border-zinc-300 text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            checked={auto}
            disabled={!isOwner || pending}
            onChange={(e) => handleToggle(e.target.checked)}
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
    </section>
  );
}
