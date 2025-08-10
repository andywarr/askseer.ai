"use client";

import { useState, useMemo } from "react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";
import { updateCommunicationPreferences } from "@/apps/nextjs-app/lib/data";
import { Button } from "@/apps/nextjs-app/components/ui/button";

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
  const [originalPrefs] = useState<Record<string, boolean>>(() => {
    // Initial defaults; parent could supply actual prefs in future
    const initial: Record<string, boolean> = {};
    PREFERENCES.forEach((p) => (initial[p.key] = true));
    return initial;
  });
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    ...originalPrefs,
  });
  const [saving, setSaving] = useState(false);

  const unsubscribeAll = OPTIONAL_KEYS.every((k) => !prefs[k]);
  const dirty = useMemo(
    () => OPTIONAL_KEYS.some((k) => prefs[k] !== originalPrefs[k]),
    [prefs, originalPrefs],
  );

  function toggle(key: string) {
    const pref = PREFERENCES.find((p) => p.key === key);
    if (pref?.required || saving) return;
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleUnsubscribeAllToggle() {
    if (saving) return;
    const turnOn = unsubscribeAll; // if currently all off -> turn them on
    setPrefs((prev) => {
      const next = { ...prev };
      OPTIONAL_KEYS.forEach((k) => (next[k] = turnOn));
      return next;
    });
  }

  function handleCancel() {
    if (saving) return;
    setPrefs({ ...originalPrefs });
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Build diff for optional keys only
      const diff: Record<string, boolean> = {};
      OPTIONAL_KEYS.forEach((k) => {
        if (prefs[k] !== originalPrefs[k]) diff[k] = prefs[k];
      });
      if (Object.keys(diff).length === 0) {
        setSaving(false);
        return;
      }
      await updateCommunicationPreferences(userId, diff);
      toast.success("Successfully updated communication preferences");
      // NOTE: originalPrefs is a state constant; in real impl we would update it or refetch
      // For now just mutate local reference so further edits compute dirty correctly
      Object.keys(diff).forEach((k) => (originalPrefs[k] = prefs[k]));
    } catch (e) {
      toast.error("Failed to update communication preferences");
    } finally {
      setSaving(false);
    }
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
                    disabled={pref.required || saving}
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
              disabled={saving}
              onCheckedChange={handleUnsubscribeAllToggle}
              aria-label="Unsubscribe from all optional communications"
            />
          </div>
        </div>
      </div>

      {/* Persistent space for action buttons to avoid layout shift */}
      <div className="mt-6 flex min-h-[2.5rem] justify-end gap-2">
        {dirty && (
          <>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
