"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";

interface Props {
  domain: string | null;
  isConsumer: boolean;
  company: { id: string; name: string; status?: string } | null;
  onCreate: (
    name?: string,
  ) => Promise<{ success: boolean } | { success: false; error: string }>;
}

export default function CompanyForDomain({
  domain,
  isConsumer,
  company,
  onCreate,
}: Props) {
  const [name, setName] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const canCreate = useMemo(
    () => !!domain && !isConsumer && !company,
    [domain, isConsumer, company],
  );

  if (!domain) return null;

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Information
        </h3>
      </div>

      {company ? (
        <div className="rounded-lg border p-4 text-sm leading-7 tracking-tight">
          <div className="text-zinc-600">Domain</div>
          <div className="mb-3 font-medium">{domain}</div>
          <div className="text-zinc-600">Company</div>
          <div className="font-medium">{company.name}</div>
        </div>
      ) : isConsumer ? (
        <div className="p-4 text-sm leading-7 tracking-tight">
          <div className="mb-1">
            Your email domain {domain} is a consumer email domain.
          </div>
          <div className="text-zinc-500">
            Company creation is only available for corporate domains.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="mt-4">
              <Label
                htmlFor="companyName"
                className="leading-7 tracking-tight text-zinc-500"
              >
                What is your company&apos;s name?
              </Label>
              <Input
                id="companyName"
                placeholder="e.g. Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
              <p className="mt-1 text-xs text-zinc-500">
                We&apos;ll associate {domain} with this company.
              </p>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() =>
                    startTransition(async () => {
                      const res = await onCreate(name.trim() || undefined);
                      if ((res as any)?.success) {
                        toast.success("Company claim successfully submitted");
                      } else {
                        toast.error(
                          (res as any)?.error ||
                            "Failed to submit company claim",
                        );
                      }
                    })
                  }
                  disabled={!canCreate || pending}
                >
                  Claim Company
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
