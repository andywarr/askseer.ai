"use client";

import { useState } from "react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";

// Types for preferences
interface CommunicationsPreferencesProps {
  userId: string;
}

interface PreferenceItem {
  key: string;
  label: string;
  description: string;
  required?: boolean; // non-optional -> always on and disabled
}

// Define the list of preferences (order matters for display)
const PREFERENCES: PreferenceItem[] = [
  {
    key: "digest",
    label: "Digests",
    description: "Summary of product usage",
  },
  {
    key: "productUpdates",
    label: "Product Updates",
    description: "New features and improvements",
  },
  {
    key: "promotions",
    label: "Promotions",
    description: "Special offers, discounts",
  },
  {
    key: "educational",
    label: "Educational",
    description: "How-to guides, tips, newsletters",
  },
  {
    key: "feedback",
    label: "Feedback",
    description: "Surveys, beta testing invitations",
  },
  {
    key: "security",
    label: "Security",
    description: "Suspicious activity (required)",
    required: true,
  },
  {
    key: "billing",
    label: "Billing",
    description: "Invoices, receipts, payment failures (required)",
    required: true,
  },
  {
    key: "policy",
    label: "Policy",
    description: "Terms of service & privacy policy updates (required)",
    required: true,
  },
];

// Helper to separate optional keys
const OPTIONAL_KEYS = PREFERENCES.filter((p) => !p.required).map((p) => p.key);

export default function CommunicationsPreferences({
  userId,
}: CommunicationsPreferencesProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    // TODO: Fetch existing preferences from API once backend exists
    // For now default: all optional ON, required ON
    const initial: Record<string, boolean> = {};
    PREFERENCES.forEach((p) => {
      initial[p.key] = true; // required or optional default to true
    });
    return initial;
  });

  const unsubscribeAll = OPTIONAL_KEYS.every((k) => !prefs[k]);

  async function persist(next: Record<string, boolean>) {
    setPrefs(next);
    // TODO: Call backend to persist (e.g., await updateCommunicationPreferences(userId, next))
  }

  function toggle(key: string) {
    const pref = PREFERENCES.find((p) => p.key === key);
    if (pref?.required) return; // required remains on
    const next = { ...prefs, [key]: !prefs[key] };
    const newValue = next[key];
    persist(next);
    toast.success(
      `${pref?.label || "Preference"} ${newValue ? "enabled" : "disabled"}`,
    );
  }

  function handleUnsubscribeAllToggle() {
    // Toggle: if currently all off -> turn all optional ON, else turn them OFF
    const turnOn = unsubscribeAll; // if all currently off, turn them on
    const next = { ...prefs };
    OPTIONAL_KEYS.forEach((k) => (next[k] = turnOn));
    persist(next);
    toast.success(
      turnOn
        ? "All optional subscriptions enabled"
        : "All optional subscriptions disabled",
    );
  }

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Communications
        </h3>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="overflow-hidden">
          {PREFERENCES.map((pref) => {
            const value = prefs[pref.key];
            return (
              <div
                key={pref.key}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="pr-4">
                  <Label className="text-sm leading-none font-medium">
                    {pref.label}
                  </Label>
                  <p className="mt-1 max-w-md text-xs text-zinc-500">
                    {pref.description}
                  </p>
                </div>
                <div className="flex h-full items-center">
                  <Switch
                    checked={pref.required ? true : value}
                    disabled={pref.required}
                    onCheckedChange={() => toggle(pref.key)}
                    aria-label={pref.label}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm leading-none font-medium">
                Unsubscribe from all optional
              </Label>
              <p className="mt-1 text-xs text-zinc-500">
                Turns off/on all optional communications
              </p>
            </div>
            <Switch
              checked={unsubscribeAll}
              onCheckedChange={handleUnsubscribeAllToggle}
              aria-label="Unsubscribe from all optional communications"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
