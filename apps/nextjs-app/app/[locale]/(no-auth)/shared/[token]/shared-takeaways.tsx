"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Bot, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { TranslationWrapper } from "@/apps/nextjs-app/components/i18n/translation-wrapper";

interface TakeawayRecommendation {
  id: string;
  sortOrder: number;
  text: string;
  source: string;
}

interface Takeaway {
  id: string;
  sortOrder: number;
  title: string;
  description: string;
  source: string;
  recommendations: TakeawayRecommendation[];
}

interface SharedTakeawaysProps {
  takeaways: Takeaway[];
  studyLocale?: string;
}

export function SharedTakeaways({ takeaways, studyLocale = "en" }: SharedTakeawaysProps) {
  const t = useTranslations("StudyTldr");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  if (!takeaways || takeaways.length === 0) {
    return null;
  }

  const isEdited = takeaways.some(
    (t) =>
      t.source === "HUMAN" ||
      t.source === "AI_HUMAN" ||
      t.recommendations?.some(
        (r) => r.source === "HUMAN" || r.source === "AI_HUMAN",
      ),
  );

  const toggleExpanded = (takeawayId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(takeawayId)) {
        next.delete(takeawayId);
      } else {
        next.add(takeawayId);
      }
      return next;
    });
  };

  return (
    <div className="mb-8">
      <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
        {t("title")}
      </h3>
      <div className="rounded-lg border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-4">
        <div className="space-y-3">
          {takeaways
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((takeaway, index) => {
              const isExpanded = expandedCards.has(takeaway.id);
              const hasRecommendations =
                takeaway.recommendations &&
                takeaway.recommendations.length > 0;

              return (
                <div
                  key={takeaway.id}
                  className="rounded-md border border-zinc-100 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Number badge */}
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug text-zinc-900">
                        <TranslationWrapper text={takeaway.title} sourceLocale={studyLocale} inline />
                      </div>
                      {takeaway.description && (
                        <div className="mt-1 text-sm leading-relaxed text-zinc-600">
                          <TranslationWrapper text={takeaway.description} sourceLocale={studyLocale} inline />
                        </div>
                      )}

                      {/* Recommendations toggle */}
                      {hasRecommendations && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleExpanded(takeaway.id)}
                            className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            {t("recommendation", { count: takeaway.recommendations.length })}
                          </button>

                          {isExpanded && (
                            <ul className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-7">
                              {takeaway.recommendations
                                .sort((a, b) => a.sortOrder - b.sortOrder)
                                .map((rec, recIndex) => (
                                  <li
                                    key={rec.id}
                                    className="text-sm leading-relaxed text-zinc-600"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="shrink-0 select-none font-medium text-zinc-900">
                                        {String.fromCharCode(97 + recIndex)}.
                                      </span>
                                      <span>
                                        <TranslationWrapper text={rec.text} sourceLocale={studyLocale} inline />
                                      </span>
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-3 flex items-center">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            {isEdited ? (
              <span className="flex items-center opacity-70 -mr-0.5">
                <Bot className="h-3.5 w-3.5" />
                <span className="text-[10px] mx-0.5">+</span>
                <User className="h-3.5 w-3.5" />
              </span>
            ) : (
              <Bot className="h-3.5 w-3.5 opacity-70" />
            )}
            {isEdited
              ? t("generatedByAiHuman")
              : t("generatedByAi")}
          </span>
        </div>
      </div>
    </div>
  );
}
