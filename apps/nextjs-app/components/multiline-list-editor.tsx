"use client";

import { useState } from "react";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { X, Plus } from "lucide-react";

type MultilineListEditorProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  maxItems?: number;
  chipWidthClass?: string; // e.g., 'w-80' for fixed width
};

export function MultilineListEditor({
  values,
  onChange,
  placeholder = "Add a quote",
  className,
  maxItems = 20,
  chipWidthClass = "w-80",
}: MultilineListEditorProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) return;
    if (values.length >= maxItems) return;
    onChange([...values, v]);
    setDraft("");
  };

  const remove = (idx: number) => {
    const next = values.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <Textarea
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-20"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={add}
          aria-label="Add item"
          disabled={!draft.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <li
              key={`${v}-${i}`}
              className={`group ${chipWidthClass} flex items-start justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/60`}
            >
              <span className="leading-5 break-words whitespace-pre-wrap">
                {v}
              </span>
              <button
                type="button"
                aria-label="Remove"
                className="pointer-events-none ml-2 rounded p-1 text-zinc-500 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 hover:text-zinc-900"
                onClick={() => remove(i)}
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
