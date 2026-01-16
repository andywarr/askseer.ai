import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Optional action element (e.g., Edit button) positioned in the header */
  headerAction?: React.ReactNode;
}

export function SettingsSection({
  title,
  children,
  className,
  headerAction,
}: SettingsSectionProps) {
  return (
    <section className={cn("group", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {title}
        </h3>
        {headerAction}
      </div>
      {children}
    </section>
  );
}
