"use client";

import FigmaConnectButton from "@/apps/nextjs-app/components/figma/figma-connect-button";
import { FigmaIcon } from "@/apps/nextjs-app/components/figma/figma-icon";
import { useTranslations } from "next-intl";

export default function AccountApps() {
  const t = useTranslations("AccountSettings");

  return (
    <section className="group">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("connectedApps.title")}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <FigmaIcon />
            <div>
              <h4 className="font-medium">{t("connectedApps.figma")}</h4>
              <p className="text-muted-foreground text-sm">
                {t("connectedApps.figmaDescription")}
              </p>
            </div>
          </div>
          <FigmaConnectButton />
        </div>
      </div>
    </section>
  );
}

