"use client";

import { useState, useMemo } from "react";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Search } from "lucide-react";

interface TranscriptEntry {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface TranscriptViewerProps {
  transcriptText: string;
  onSeek?: (timestamp: number) => void;
  currentTime?: number;
}

/**
 * Renders a speaker-labeled transcript synced to the video timeline.
 * Supports text search and click-to-seek.
 *
 * Expected transcript format (newline-delimited):
 *   [MM:SS] Speaker: Text
 *
 * Falls back to plain text if parsing fails.
 */
export function TranscriptViewer({
  transcriptText,
  onSeek,
  currentTime = 0,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const entries = useMemo(() => {
    if (!transcriptText) return [];

    const lines = transcriptText.split("\n").filter(Boolean);
    const parsed: TranscriptEntry[] = [];

    for (const line of lines) {
      // Try parsing "[MM:SS] Speaker: Text"
      const match = line.match(/^\[(\d+):(\d+)\]\s*([^:]+):\s*(.+)$/);
      if (match) {
        const startTime = parseInt(match[1]) * 60 + parseInt(match[2]);
        parsed.push({
          speaker: match[3].trim(),
          text: match[4].trim(),
          startTime,
          endTime: startTime + 30, // Approximate
        });
      } else {
        // Fallback: plain text
        parsed.push({
          speaker: "",
          text: line.trim(),
          startTime: 0,
          endTime: 0,
        });
      }
    }

    return parsed;
  }, [transcriptText]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.text.toLowerCase().includes(q) || e.speaker.toLowerCase().includes(q),
    );
  }, [entries, searchQuery]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!transcriptText) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        No transcript available yet. It will be generated after the recording is
        processed.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcript..."
          className="h-8 pl-9 text-sm"
        />
      </div>

      {/* Transcript Entries */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-1">
          {filteredEntries.map((entry, i) => {
            const isActive =
              entry.startTime > 0 &&
              currentTime >= entry.startTime &&
              currentTime < entry.endTime;

            return (
              <button
                key={i}
                onClick={() => entry.startTime > 0 && onSeek?.(entry.startTime)}
                className={`flex w-full gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 border-primary border-l-2"
                    : "hover:bg-accent"
                } ${entry.startTime > 0 ? "cursor-pointer" : "cursor-default"}`}
              >
                {entry.startTime > 0 && (
                  <span className="text-muted-foreground w-10 shrink-0 pt-0.5 font-mono text-xs">
                    {formatTime(entry.startTime)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {entry.speaker && (
                    <span className="text-primary mr-1.5 text-xs font-medium">
                      {entry.speaker}:
                    </span>
                  )}
                  <span className="text-foreground">{entry.text}</span>
                </div>
              </button>
            );
          })}
          {filteredEntries.length === 0 && searchQuery && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No matches found for &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
