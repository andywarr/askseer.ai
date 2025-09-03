import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate initials: first letter of first and last word; if single word, first letter only.
// Returns null when no valid letter characters are found (so callers can fallback to an icon).
export function getInitials(name: string): string | null {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const firstLetter = findFirstLetter(words[0]);
  const lastLetter =
    words.length > 1 ? findFirstLetter(words[words.length - 1]) : null;

  const parts = [firstLetter, lastLetter].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!.toUpperCase();
  return (parts[0] + parts[1]).toUpperCase();
}

// Helper: find the first Unicode letter in a string (returns null if none)
function findFirstLetter(input: string): string | null {
  for (const ch of Array.from(input)) {
    if (/\p{L}/u.test(ch)) return ch;
  }
  return null;
}
