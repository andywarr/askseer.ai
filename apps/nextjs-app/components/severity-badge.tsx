"use client";

import { getSeverityInfo } from "@/apps/nextjs-app/utils/severity";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
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

  const tooltipText =
    info.label === "None" ? info.label : `${info.label} severity`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "font-medium",
            info.bgColor,
            info.borderColor,
            info.textColor,
            className,
          )}
        >
          {showLabel && <span>{info.label}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
