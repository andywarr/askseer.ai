import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate initials: first letter of first and last word; if single word, first letter only
export function getInitials(name: string) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return (words[0]?.charAt(0) || "?").toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
