import type { LucideIcon } from "lucide-react";

/**
 * A single item to display in a persona section card.
 */
export type PersonaSectionItem = {
  label: string;
  Icon: LucideIcon;
} & (
  | { isList: false; value: string }
  | { isList: true; values: string[] }
);

/**
 * Props for PersonaSectionCard component.
 */
export interface PersonaSectionCardProps {
  /** Section title (e.g., "Demographics", "Psychographics") */
  title: string;
  /** HTML id for the section heading (for aria-labelledby) */
  headingId: string;
  /** Items to display in the section */
  items: PersonaSectionItem[];
}

/**
 * A reusable section card for displaying persona data.
 * Renders a titled grid of items with icons and optional tag lists.
 */
export function PersonaSectionCard({
  title,
  headingId,
  items,
}: PersonaSectionCardProps) {
  if (items.length === 0) return null;

  return (
    <section className="pb-10 pl-0 md:pl-48" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 text-lg font-semibold tracking-tight"
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => {
          const IconComp = item.Icon;
          const ariaLabel = item.isList
            ? item.label
            : `${item.label}: ${item.value}`;
          const key = item.isList
            ? `${item.label}-${idx}`
            : `${item.label}-${item.value.slice(0, 16)}`;

          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border p-3"
              aria-label={ariaLabel}
            >
              <IconComp
                className="text-muted-foreground h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-muted-foreground text-xs">
                  {item.label}
                </div>
                {item.isList ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.values.map((v) => (
                      <span
                        key={`${item.label}-${v}`}
                        className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-5 font-medium dark:border-zinc-700 dark:bg-zinc-800/60"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="truncate leading-6 font-medium">
                    {item.value}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
