"use client";

import { useState } from "react";
import { LibraryHeuristics } from "@/apps/nextjs-app/app/(auth)/library/heuristics/library-heuristics";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/apps/nextjs-app/components/ui/tabs";
import type { HeuristicFamily } from "./types";

interface LibraryContentProps {
  userId: string;
  companyId: string | null;
  isCompanyAdmin: boolean;
  initialFamilies: HeuristicFamily[];
}

export function LibraryContent({
  userId,
  companyId,
  isCompanyAdmin,
  initialFamilies,
}: LibraryContentProps) {
  const [activeTab, setActiveTab] = useState("heuristics");

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="heuristics">Heuristics</TabsTrigger>
          {/* Placeholder for future items */}
          {/* <TabsTrigger value="questions">Questions</TabsTrigger> */}
        </TabsList>

        <TabsContent value="heuristics" className="mt-6">
          <LibraryHeuristics
            userId={userId}
            companyId={companyId}
            isCompanyAdmin={isCompanyAdmin}
            initialFamilies={initialFamilies}
          />
        </TabsContent>

        {/* Placeholder for future tabs */}
        {/* <TabsContent value="questions" className="mt-6">
          <LibraryQuestions />
        </TabsContent> */}
      </Tabs>
    </div>
  );
}
