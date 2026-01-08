"use client";

import { getSeverityInfo } from "@/apps/nextjs-app/utils/severity";
import type { SeverityRating } from "@/apps/nextjs-app/utils/severity";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface SeverityBadgeProps {
  severity?: number | null;
  showLabel?: boolean;
  className?: string;
  onSeverityChange?: (severity: SeverityRating) => void;
  disabled?: boolean;
}

const SEVERITY_OPTIONS: SeverityRating[] = [0, 1, 2, 3, 4];

export function SeverityBadge({
  severity,
  showLabel = true,
  className,
  onSeverityChange,
  disabled = false,
}: SeverityBadgeProps) {
  const info = getSeverityInfo(severity);

  // If no onChange handler is provided or disabled, render a non-interactive badge
  if (!onSeverityChange || disabled) {
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
      >
        {showLabel && <span>{info.label}</span>}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer font-medium transition-opacity hover:opacity-80",
            info.bgColor,
            info.borderColor,
            info.textColor,
            className,
          )}
        >
          {showLabel && <span>{info.label}</span>}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {SEVERITY_OPTIONS.map((level) => {
          const optionInfo = getSeverityInfo(level);
          if (!optionInfo) return null;

          return (
            <DropdownMenuItem
              key={level}
              onClick={() => onSeverityChange(level)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn("h-3 w-3 rounded-full", optionInfo.bgColor)}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{optionInfo.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {optionInfo.description}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
