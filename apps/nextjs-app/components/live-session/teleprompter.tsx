"use client";

import { useMemo, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeleprompterProps {
  /** Raw discussion guide text (will be split into items on blank lines). */
  text: string | null;
  /** Whether the teleprompter overlay is visible. */
  visible: boolean;
  /** Current item index. */
  currentIndex: number;
  /** Total number of parsed items (provided so parent can clamp). */
  totalItems?: number;
  /** Called when the interviewer navigates. Only fired for role="INTERVIEWER". */
  onIndexChange?: (newIndex: number) => void;
  /** Determines keyboard-navigation behaviour. */
  role: "INTERVIEWER" | "OBSERVER";
}

/**
 * Parse a discussion guide into teleprompter items.
 *
 * Each non-empty line becomes its own item, except indented or bulleted
 * sub-lines which are grouped with the preceding parent line.
 * Works with any format — numbered lists, Roman numerals, headers, plain text.
 */
export function parseGuideItems(text: string): string[] {
  const lines = text.split("\n");
  const items: string[] = [];
  let accumulator = "";

  for (const raw of lines) {
    const line = raw.trim();

    // Empty line → flush accumulator
    if (!line) {
      if (accumulator) {
        items.push(accumulator.trim());
        accumulator = "";
      }
      continue;
    }

    // Indented (2+ leading spaces/tab) or bulleted sub-item → group with parent
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const isBullet = /^[-–—•]\s/.test(line);

    if (accumulator && (leadingWhitespace >= 2 || isBullet)) {
      accumulator += "\n" + line;
      continue;
    }

    // Regular line → flush previous, start new
    if (accumulator) items.push(accumulator.trim());
    accumulator = line;
  }

  // Flush last item
  if (accumulator) items.push(accumulator.trim());

  return items.filter(Boolean);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Teleprompter({
  text,
  visible,
  currentIndex,
  onIndexChange,
  role,
}: TeleprompterProps) {
  const items = useMemo(() => (text ? parseGuideItems(text) : []), [text]);

  const goPrev = useCallback(() => {
    if (!onIndexChange) return;
    onIndexChange(Math.max(0, currentIndex - 1));
  }, [onIndexChange, currentIndex]);

  const goNext = useCallback(() => {
    if (!onIndexChange) return;
    onIndexChange(Math.min(items.length - 1, currentIndex + 1));
  }, [onIndexChange, currentIndex, items.length]);

  // Keyboard navigation — interviewer only
  useEffect(() => {
    if (role !== "INTERVIEWER" || !visible || items.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [role, visible, items.length, goPrev, goNext]);

  // Nothing to display
  if (!visible || items.length === 0) return null;

  const current = items[currentIndex] ?? items[0];
  const next = items[currentIndex + 1] ?? null;

  return (
    <div
      className="pointer-events-auto absolute bottom-full left-1/2 mb-2 flex w-[400px] -translate-x-1/2 flex-col gap-1 rounded-lg border border-zinc-700/60 bg-zinc-900/70 px-4 py-3 shadow-xl backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress + nav arrows */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
          Discussion Guide
        </span>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] tabular-nums text-zinc-500">
            {currentIndex + 1} / {items.length}
          </span>

          {role === "INTERVIEWER" && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={currentIndex >= items.length - 1}
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current item */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">
        {current}
      </p>

      {/* Next item (dimmed + smaller) */}
      {next && (
        <p className="mt-1 whitespace-pre-wrap border-t border-zinc-700/40 pt-1.5 text-xs leading-relaxed text-zinc-400/70">
          {next}
        </p>
      )}
    </div>
  );
}
