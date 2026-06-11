"use client";

import { Globe } from "lucide-react";
import { useTranslationContext } from "./translation-context";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { useTranslations, useLocale } from "next-intl";

interface GlobalTranslateButtonProps {
  studyLocale: string;
  className?: string;
}

export function GlobalTranslateButton({
  studyLocale,
  className,
}: GlobalTranslateButtonProps) {
  const context = useTranslationContext();
  const activeLocale = useLocale();
  const t = useTranslations("Translation");

  if (!context) return null;

  const hasLocaleMismatch = studyLocale !== activeLocale;
  if (!hasLocaleMismatch) return null;

  const { isGlobalTranslated, setGlobalTranslated } = context;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setGlobalTranslated(!isGlobalTranslated);
  };

  const tooltipText = isGlobalTranslated
    ? t("showOriginal")
    : t("translateTo", { language: t(`languages.${activeLocale}`) });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={handleToggle}
          aria-label={tooltipText}
        >
          <Globe
            className={`h-4 w-4 transition-colors ${
              isGlobalTranslated
                ? "text-green-600 dark:text-green-500"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
