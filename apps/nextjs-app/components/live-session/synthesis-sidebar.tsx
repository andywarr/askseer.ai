"use client";

import { useState } from "react";
import { ReactionTags } from "./reaction-tags";
import { LiveSessionNotes } from "./live-session-notes";
import { BackroomChat } from "./backroom-chat";
import { Tags, StickyNote, MessageSquare } from "lucide-react";

type SynthesisTab = "chat" | "tags" | "notes";

interface SynthesisSidebarProps {
  sessionId: string;
  startTime: number;
  showChat?: boolean;
}

/**
 * The "Command Center" synthesis sidebar with tabs for Backroom Chat, Tags, and Notes.
 * Used by Interviewer and Observer views.
 */
export function SynthesisSidebar({
  sessionId,
  startTime,
  showChat = true,
}: SynthesisSidebarProps) {
  const [activeTab, setActiveTab] = useState<SynthesisTab>(
    showChat ? "chat" : "tags",
  );

  const tabs: {
    key: SynthesisTab;
    label: string;
    icon: React.ReactNode;
    show: boolean;
  }[] = [
    {
      key: "chat",
      label: "Chat",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      show: showChat,
    },
    {
      key: "tags",
      label: "Tags",
      icon: <Tags className="h-3.5 w-3.5" />,
      show: true,
    },
    {
      key: "notes",
      label: "Notes",
      icon: <StickyNote className="h-3.5 w-3.5" />,
      show: true,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Tab Bar */}
      <div className="flex border-b">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground border-b-2"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" && showChat && (
          <BackroomChat sessionId={sessionId} startTime={startTime} />
        )}
        {activeTab === "tags" && (
          <ReactionTags sessionId={sessionId} startTime={startTime} />
        )}
        {activeTab === "notes" && (
          <LiveSessionNotes sessionId={sessionId} startTime={startTime} />
        )}
      </div>
    </div>
  );
}
