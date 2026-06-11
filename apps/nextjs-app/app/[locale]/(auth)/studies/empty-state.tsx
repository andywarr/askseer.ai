"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Users, Plus, Sparkles } from "lucide-react";

interface EmptyStateProps {
  isCompanyUser: boolean;
  hasJoinedCompanyTeams: boolean;
  companyName?: string | null;
}

export function EmptyState({
  isCompanyUser,
  hasJoinedCompanyTeams,
  companyName,
}: EmptyStateProps) {
  const t = useTranslations("StudiesPage.emptyState");
  const locale = useLocale();

  const getLocalizedHref = (href: string) => {
    if (locale === "en") return href;
    return `/${locale}${href === "/" ? "" : href}`;
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Sparkles className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {isCompanyUser && !hasJoinedCompanyTeams
            ? t("companyNoStudies", { companyName: companyName || "your company" })
            : t("noStudies")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {isCompanyUser && !hasJoinedCompanyTeams ? (
          <>
            <Button asChild>
              <Link href={getLocalizedHref("/team")}>
                <Users className="mr-2 h-4 w-4" />
                {t("browseTeams")}
              </Link>
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              {t("orText")}
              <Link href={getLocalizedHref("/new")} className="hover:text-foreground underline">
                {t("exploreOwn")}
              </Link>
            </p>
          </>
        ) : (
          <>
            <Button asChild>
              <Link href={getLocalizedHref("/new")}>
                <Plus className="mr-2 h-4 w-4" />
                {t("newButton")}
              </Link>
            </Button>
            {isCompanyUser && (
              <p className="text-muted-foreground text-center text-sm">
                {t("collaborateText")}
                <Link href={getLocalizedHref("/team")} className="hover:text-foreground underline">
                  {t("browseTeamsCompany", { companyName: companyName || "your company" })}
                </Link>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
