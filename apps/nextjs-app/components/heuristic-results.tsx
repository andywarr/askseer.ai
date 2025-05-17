"use client";

import { useState } from "react";
import { ViolatedType } from "@prisma/client";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import Image from "next/image";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import { InfoCard } from "@/apps/nextjs-app/components/ui/info-card";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  type: string;
  presignedUrls: string[];
  files: any[];
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated,
  type,
  presignedUrls,
  files,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);

  // Filter out non-violated heuristics if the switch is on
  const filteredGroupedResults = hideNonViolated
    ? Object.fromEntries(
        Object.entries(groupedResultsByHeuristic).filter(([_, items]) =>
          items.some((item) => item.violated === ViolatedType.YES),
        ),
      )
    : groupedResultsByHeuristic;

  return (
    <>
      <div className="mb-4 flex">
        <div className="flex-grow">
          <p className="font-semibold leading-7 tracking-tight">Heuristics</p>
          <p className="leading-7">{type}</p>
        </div>
        <div className="flex items-baseline gap-4">
          <p className={`${violated > 0 ? "text-red-500" : ""}`}>
            <span className="text-4xl">{violated}</span>
            <span>
              {` violated ${violated === 1 ? "heuristic" : "heuristics"}
              `}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Switch
              checked={hideNonViolated}
              onCheckedChange={setHideNonViolated}
              aria-label="Toggle non-violated heuristics"
            />
            <span className="text-sm text-zinc-500">Only show violated</span>
          </div>
        </div>
      </div>

      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={Object.entries(filteredGroupedResults)
          .filter(([_, items]) =>
            items.some((item) => item.violated === ViolatedType.YES),
          )
          .map(([key]) => key)}
      >
        {Object.entries(filteredGroupedResults).map(([key, items]) => {
          const isViolated = items.some(
            (item) => item.violated === ViolatedType.YES,
          );
          const violatedItems = items.filter(
            (item) => item.violated === ViolatedType.YES,
          );

          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <span
                    className={`font-medium ${isViolated ? "text-red-500" : ""}`}
                  >
                    {items[0].heuristic?.heuristic || "N/A"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!isViolated ? (
                  <p className="py-4 text-zinc-500">No issues found.</p>
                ) : (
                  <div className="space-y-6 py-4">
                    {violatedItems.map((item, index) => [
                      index > 0 && (
                        <div
                          key={`sep-${index}`}
                          className="h-px bg-zinc-200"
                        />
                      ),
                      <div key={index} className="space-y-4">
                        <div
                          className={`grid grid-cols-1 gap-4 ${item.fileId ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}
                        >
                          {item.fileId && (
                            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                              <div className="p-1">
                                <Image
                                  src={
                                    presignedUrls[
                                      files.findIndex(
                                        (f) => f.id === item.fileId,
                                      )
                                    ] || ""
                                  }
                                  alt="Issue screenshot"
                                  width={500}
                                  height={500}
                                  className="max-h-60 rounded-lg border border-zinc-200 object-contain"
                                  priority={true}
                                  unoptimized={true}
                                />
                              </div>
                            </div>
                          )}
                          <div>
                            <InfoCard
                              type="issue"
                              title="Issue"
                              content={item.reason}
                              source={item.source}
                            />
                          </div>
                          <div className="space-y-4">
                            {item.recommendations.map((rec, recIndex) => (
                              <InfoCard
                                key={recIndex}
                                type="recommendation"
                                title="Recommendation"
                                content={rec.recommendation}
                                source={rec.source}
                              />
                            ))}
                          </div>
                        </div>
                      </div>,
                    ])}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
