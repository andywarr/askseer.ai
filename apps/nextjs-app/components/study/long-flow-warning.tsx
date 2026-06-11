"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import { useTranslations } from "next-intl";

export function LongFlowWarning() {
  const t = useTranslations("SharedStudyComponents.longFlowWarning");

  return (
    <Alert
      variant="destructive"
      className="mt-4 flex items-center gap-2 border-amber-200 bg-amber-50 text-amber-800 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <strong>{t("strongText")}</strong>{" "}
        {t("descText", { threshold: LONG_FLOW_WARNING_THRESHOLD })}
      </AlertDescription>
    </Alert>
  );
}
