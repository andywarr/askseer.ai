"use client";

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { X, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export type Goal = { want: string; soThat: string };

function toSentence(g: Goal, wantPrefix: string = "I want to", soThatPrefix: string = "so that I can"): string {
  const want = (g.want || "").trim();
  const soThat = (g.soThat || "").trim();
  if (!want && !soThat) return "";
  if (want && soThat) return `${wantPrefix} ${want} ${soThatPrefix} ${soThat}`;
  // We typically require both, but be defensive
  if (want) return `${wantPrefix} ${want}`;
  return soThat;
}

function normalize(initial: unknown, wantPrefix: string = "I want to", soThatPrefix: string = "so that I can"): string[] {
  if (Array.isArray(initial)) {
    if (initial.length === 0) return [];
    if (typeof initial[0] === "string") {
      return (initial as string[]).map((s) => s.trim()).filter(Boolean);
    }
    return (initial as Goal[])
      .map((g) => toSentence({ want: g.want || "", soThat: g.soThat || "" }, wantPrefix, soThatPrefix))
      .filter(Boolean);
  }
  if (typeof initial === "string") {
    const s = initial.trim();
    return s ? [s] : [];
  }
  return [];
}

export function GoalsEditor({
  value,
  onChange,
  placeholderWant,
  placeholderSoThat,
  rightAction,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
  placeholderWant?: string;
  placeholderSoThat?: string;
  rightAction?: ReactNode;
}) {
  const t = useTranslations("StudyWizardForms.persona.fields");
  const wantPrefix = t("goalWantPrefix");
  const soThatPrefix = t("goalSoThatPrefix");
  
  const finalPlaceholderWant = placeholderWant ?? t("goalWantPlaceholder");
  const finalPlaceholderSoThat = placeholderSoThat ?? t("goalSoThatPlaceholder");

  const items = useMemo(() => normalize(value, wantPrefix, soThatPrefix), [value, wantPrefix, soThatPrefix]);
  const [draft, setDraft] = useState<Goal>({ want: "", soThat: "" });

  const add = () => {
    const w = draft.want.trim();
    const s = draft.soThat.trim();
    if (!w && !s) return;
    const sentence = toSentence({ want: w, soThat: s }, wantPrefix, soThatPrefix);
    const next = [...items, sentence];
    onChange(next);
    setDraft({ want: "", soThat: "" });
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Draft row (input) */}
      <div className="flex w-full flex-col gap-2 md:flex-row md:flex-nowrap md:items-center">
        <div className="flex w-full items-center gap-2 md:w-1/2">
          <span className="text-sm whitespace-nowrap text-zinc-600">
            {wantPrefix}
          </span>
          <Input
            className="h-9 w-full min-w-0 flex-1"
            value={draft.want}
            onChange={(e) => setDraft((d) => ({ ...d, want: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.want.trim() && draft.soThat.trim()) {
                  add();
                }
              }
            }}
            placeholder={finalPlaceholderWant}
          />
        </div>
        <div className="flex w-full items-center gap-2 md:w-1/2">
          <span className="text-sm whitespace-nowrap text-zinc-600">
            {soThatPrefix}
          </span>
          <Input
            className="h-9 w-full min-w-0 flex-1"
            value={draft.soThat}
            onChange={(e) =>
              setDraft((d) => ({ ...d, soThat: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.want.trim() && draft.soThat.trim()) {
                  add();
                }
              }
            }}
            placeholder={finalPlaceholderSoThat}
          />
          <Button
            type="button"
            onClick={add}
            disabled={!draft.want.trim() || !draft.soThat.trim()}
            size="icon"
            variant="secondary"
            className="shrink-0"
            aria-label={t("addGoal")}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {rightAction ? (
            <div className="ml-1 shrink-0">{rightAction}</div>
          ) : null}
        </div>
      </div>

      {/* Added items (non-editable) */}
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((text, idx) => (
            <li
              key={idx}
              className="group flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              <span className="truncate">{text}</span>
              <button
                type="button"
                aria-label={t("removeGoal")}
                className="pointer-events-none ml-2 rounded p-1 text-zinc-500 transition-opacity group-hover:pointer-events-auto group-hover:opacity-90 hover:text-zinc-900"
                onClick={() => remove(idx)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
