"use client";

import { getSeverityInfo } from "@/apps/nextjs-app/utils/severity";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { cn } from "@/apps/nextjs-app/lib/utils";

interface SeverityBadgeProps {
  severity?: number | null;
  showLabel?: boolean;
  className?: string;
}

export function SeverityBadge({
  severity,
  showLabel = true,
  className,
}: SeverityBadgeProps) {
  const info = getSeverityInfo(severity);

  if (!info) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        info.bgColor,
        info.borderColor,
        info.textColor,
        className,
      )}
      title={info.description}
    >
      {showLabel && (
        <>
          <span className="font-semibold">{info.level}</span>
          <span className="mx-1">·</span>
        </>
      )}
      <span>{info.label}</span>
    </Badge>
  );
}
