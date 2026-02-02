/**
 * Shared utility functions for persona page and components.
 */

/**
 * Normalize a value to a deduplicated, trimmed string array.
 * Handles arrays, comma-separated strings, or returns empty array.
 */
export function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value.map((s) => String(s).trim()).filter((s) => s.length > 0),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    );
  }
  return [];
}

/**
 * Convert a value to a single trimmed string.
 * Handles strings, arrays (joined with ", "), or returns empty string.
 */
export function toSingleString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
}

/**
 * Format a date/time value using the user's locale.
 */
export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Generate initials from a name string.
 * Takes first letter of first two words, capitalized.
 */
export function getInitials(name: string | undefined | null): string {
  return (
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}
