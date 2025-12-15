"use client";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { NewHeuristicSetForm } from "./new-heuristic-set-form";

interface NewHeuristicSetFormWrapperProps {
  companyId: string;
}

export function NewHeuristicSetFormWrapper({
  companyId,
}: NewHeuristicSetFormWrapperProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <NewHeuristicSetForm companyId={companyId} />
    </DndProvider>
  );
}
