"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { Button } from "@/apps/nextjs-app/components/ui/button";

const SESSION_STORAGE_KEY = "noFundsAlertDismissedTeamId";

interface NoFundsAlertProps {
  balanceCents: number;
  studyCostCents: number;
  canPurchaseCredits?: boolean;
  teamId?: string | null;
  teamName?: string | null;
}

export function NoFundsAlert({
  balanceCents,
  studyCostCents,
  canPurchaseCredits,
  teamId,
  teamName,
}: NoFundsAlertProps) {
  const t = useTranslations("StudiesPage.noFundsAlert");
  const locale = useLocale();
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevTeamIdRef = useRef<string | null | undefined>(teamId);

  const getLocalizedHref = (href: string) => {
    if (locale === "en") return href;
    return `/${locale}${href === "/" ? "" : href}`;
  };

  // Check sessionStorage on mount and when team changes
  useEffect(() => {
    setMounted(true);
    const currentTeamKey = teamId ?? "default";
    const dismissedTeamId = sessionStorage.getItem(SESSION_STORAGE_KEY);

    // If team changed, clear the dismissed state for the old team
    if (prevTeamIdRef.current !== teamId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setIsDismissed(false);
      prevTeamIdRef.current = teamId;
    } else {
      // On mount or same team, check if this team was dismissed
      setIsDismissed(dismissedTeamId === currentTeamKey);
    }
  }, [teamId]);

  // Don't render during SSR to avoid flash when sessionStorage has a dismissal
  if (!mounted) {
    return null;
  }

  if (balanceCents >= studyCostCents) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, teamId ?? "default");
    setIsDismissed(true);
  };

  const costStr = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(studyCostCents / 100);
  const balanceStr = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(balanceCents / 100);
  const displayName = teamName ?? (locale === "es" ? "El equipo seleccionado" : "The selected team");

  return (
    <Alert
      variant="destructive"
      className="mb-6 flex min-h-14 items-center justify-between gap-2 bg-red-50 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <AlertDescription>
          {canPurchaseCredits
            ? t("hasFundsRequired", { teamName: displayName, cost: costStr, balance: balanceStr })
            : t("adminFundsRequired", { teamName: displayName, cost: costStr })}
        </AlertDescription>
      </div>
      <div className="flex items-center gap-2">
        {canPurchaseCredits && (
          <Button
            asChild
            size="sm"
            className="shrink-0 text-black"
            variant="outline"
          >
            <Link href={getLocalizedHref("/funds")}>{t("manageFunds")}</Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-red-600 hover:!bg-red-100 hover:text-red-800"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
