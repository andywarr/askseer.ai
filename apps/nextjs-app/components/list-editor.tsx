"use client";

import { useState } from "react";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { X, Plus } from "lucide-react";

type ListEditorProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string; // unused now; kept for compatibility
  className?: string;
  maxItems?: number;
};

export function ListEditor({
  values,
  onChange,
  placeholder = "Add item and press Enter",
  addLabel = "Add",
  className,
  maxItems = 50,
}: ListEditorProps) {
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
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
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
              className="group flex w-fit items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              <span className="truncate">{v}</span>
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
