"use client";

import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { toast } from "sonner";
import { updateCommunicationPreferences } from "@/apps/nextjs-app/lib/db/data";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

// Types for preferences
interface CommunicationsPreferencesProps {
  userId: string;
  initialPreferences?: Record<string, boolean>;
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

// Create initial preferences with all values set to true
const createInitialPrefs = (): Record<string, boolean> => {
  const initial: Record<string, boolean> = {};
  PREFERENCES.forEach((p) => (initial[p.key] = true));
  return initial;
};

export default function CommunicationsPreferences({
  userId,
  initialPreferences,
}: CommunicationsPreferencesProps) {
  const t = useTranslations("AccountSettings");

  // Merge server preferences with defaults, ensuring all keys exist
  const mergeWithDefaults = useCallback(
    (serverPrefs?: Record<string, boolean>): Record<string, boolean> => {
      const defaults = createInitialPrefs();
      if (!serverPrefs) return defaults;
      return { ...defaults, ...serverPrefs };
    },
    [],
  );

  const [savedPrefs, setSavedPrefs] = useState<Record<string, boolean>>(() =>
    mergeWithDefaults(initialPreferences),
  );
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    mergeWithDefaults(initialPreferences),
  );
  const [saving, setSaving] = useState(false);

  const unsubscribeAll = OPTIONAL_KEYS.every((k) => !prefs[k]);
  const dirty = useMemo(
    () => OPTIONAL_KEYS.some((k) => prefs[k] !== savedPrefs[k]),
    [prefs, savedPrefs],
  );

  const toggle = useCallback(
    (key: string) => {
      const pref = PREFERENCES.find((p) => p.key === key);
      if (pref?.required || saving) return;
      setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [saving],
  );

  const handleUnsubscribeAllToggle = useCallback(() => {
    if (saving) return;
    const turnOn = unsubscribeAll; // if currently all off -> turn them on
    setPrefs((prev) => {
      const next = { ...prev };
      OPTIONAL_KEYS.forEach((k) => (next[k] = turnOn));
      return next;
    });
  }, [saving, unsubscribeAll]);

  const handleCancel = useCallback(() => {
    if (saving) return;
    setPrefs({ ...savedPrefs });
  }, [saving, savedPrefs]);

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Build diff for optional keys only
      const diff: Record<string, boolean> = {};
      OPTIONAL_KEYS.forEach((k) => {
        if (prefs[k] !== savedPrefs[k]) diff[k] = prefs[k];
      });
      if (Object.keys(diff).length === 0) {
        setSaving(false);
        return;
      }
      await updateCommunicationPreferences(userId, diff);
      toast.success(t("communications.successUpdate"));
      // Update saved state to reflect current prefs
      setSavedPrefs({ ...prefs });
    } catch (e) {
      toast.error(t("communications.errorUpdate"));
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, prefs, savedPrefs, userId, t]);

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("communications.title")}
        </h3>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="overflow-hidden">
          {PREFERENCES.map((pref) => {
            const value = prefs[pref.key];
            const label = t(`communications.preferences.${pref.key}.label`);
            const description = t(`communications.preferences.${pref.key}.description`);
            return (
              <div
                key={pref.key}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="pr-4">
                  <Label className="text-sm leading-none font-medium">
                    {label}
                  </Label>
                  <p className="mt-1 max-w-md text-xs text-zinc-500">
                    {description}
                  </p>
                </div>
                <div className="flex h-full items-center">
                  <Switch
                    checked={pref.required ? true : value}
                    disabled={pref.required || saving}
                    onCheckedChange={() => toggle(pref.key)}
                    aria-label={label}
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
                {t("communications.unsubscribeAllLabel")}
              </Label>
              <p className="mt-1 text-xs text-zinc-500">
                {t("communications.unsubscribeAllDesc")}
              </p>
            </div>
            <Switch
              checked={unsubscribeAll}
              disabled={saving}
              onCheckedChange={handleUnsubscribeAllToggle}
              aria-label={t("communications.unsubscribeAllAriaLabel")}
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
              {t("communications.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("communications.save")}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
