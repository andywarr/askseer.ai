"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";

interface Props {
  domain: string | null;
  isConsumer: boolean;
  company: { id: string; name: string } | null;
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
          Company
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
        <div className="rounded-lg border p-4 text-sm leading-7 tracking-tight">
          <div className="mb-1">
            Your email domain {domain} is a consumer email domain.
          </div>
          <div className="text-zinc-500">
            Company creation is only available for corporate domains.
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm leading-7 tracking-tight">
              <div className="text-zinc-600">Domain</div>
              <div className="font-medium">{domain}</div>
            </div>
            <div className="mt-4">
              <Label
                htmlFor="companyName"
                className="text-xs leading-7 tracking-tight text-zinc-500"
              >
                Company name
              </Label>
              <Input
                id="companyName"
                placeholder="e.g. Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
              <p className="mt-1 text-[0.8rem] text-zinc-500">
                We&apos;ll associate {domain} with this company so teammates can
                join automatically.
              </p>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() =>
                    startTransition(async () => {
                      const res = await onCreate(name.trim() || undefined);
                      if ((res as any)?.success) {
                        toast.success("Company created for domain");
                      } else {
                        toast.error(
                          (res as any)?.error || "Failed to create company",
                        );
                      }
                    })
                  }
                  disabled={!canCreate || pending}
                >
                  {pending ? "Creating…" : "Create company"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
