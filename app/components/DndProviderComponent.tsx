"use client";

// React imports
import { ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const DndProviderComponent = ({ children }: { children: ReactNode }) => {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
};

export default DndProviderComponent;
