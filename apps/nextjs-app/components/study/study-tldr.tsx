"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bot,
  RefreshCcw,
  Trash2,
  User,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import { generateStudyTldr } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { getStudyTldrStatus } from "@/apps/nextjs-app/lib/db/data";
import { EditableField } from "@/apps/nextjs-app/components/ui/editable-field";
import {
  updateStudyTakeawayAction,
  deleteStudyTakeawayAction,
  updateTakeawayRecommendationAction,
  deleteTakeawayRecommendationAction,
  createTakeawayRecommendationAction,
  createStudyTakeawayAction,
} from "@/apps/nextjs-app/lib/actions/study-takeaway-actions";

// ==========================================
// Types
// ==========================================

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

interface StudyTldrProps {
  studyId: string;
  userId: string;
  initialTldrStatus: string | null;
  initialTakeaways: Takeaway[];
  canManage: boolean;
}

// ==========================================
// Component
// ==========================================

export function StudyTldr({
  studyId,
  userId,
  initialTldrStatus,
  initialTakeaways,
  canManage,
}: StudyTldrProps) {
  const [tldrStatus, setTldrStatus] = useState(initialTldrStatus || "PENDING");
  const [takeaways, setTakeaways] = useState<Takeaway[]>(initialTakeaways);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Sync state with server props (for when server actions trigger revalidatePath)
  useEffect(() => {
    setTldrStatus(initialTldrStatus || "PENDING");
    setTakeaways(initialTakeaways);
  }, [initialTldrStatus, initialTakeaways]);
  
  // Local state for inline edits
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  // State for inline "add recommendation"
  const [addingRecForTakeaway, setAddingRecForTakeaway] = useState<string | null>(null);
  const [newRecText, setNewRecText] = useState("");
  const [isSavingNewRec, setIsSavingNewRec] = useState(false);
  const newRecTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleUpdateTakeaway = async (
    id: string,
    field: "title" | "description",
    value: string,
  ) => {
    const key = `${id}-${field}`;
    setSavingFields((prev) => ({ ...prev, [key]: true }));
    setHasLocalEdits(true);

    // Optimistic update
    setTakeaways((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value, source: "AI_HUMAN" } : t)),
    );

    try {
      const res = await updateStudyTakeawayAction(
        id,
        { [field]: value },
        studyId,
      );
      if (!res.success) {
        toast.error(res.error);
        setTakeaways(initialTakeaways); // Revert on failure
      } else {
        toast.success("Takeaway updated");
      }
    } catch (error) {
      toast.error("Failed to update takeaway");
      setTakeaways(initialTakeaways); // Revert on failure
    } finally {
      setSavingFields((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteTakeaway = async (id: string) => {
    // Optimistic UI update
    setTakeaways((prev) => prev.filter((t) => t.id !== id));
    setHasLocalEdits(true);
    
    try {
      const res = await deleteStudyTakeawayAction(id, studyId);
      if (!res.success) {
        toast.error(res.error);
        setTakeaways(initialTakeaways); // Revert on failure
      } else {
        toast.success("Takeaway deleted");
      }
    } catch (error) {
      toast.error("Failed to delete takeaway");
      setTakeaways(initialTakeaways); // Revert on failure
    }
  };

  const handleUpdateRecommendation = async (
    id: string,
    value: string,
  ) => {
    const key = `rec-${id}`;
    setSavingFields((prev) => ({ ...prev, [key]: true }));
    setHasLocalEdits(true);

    // Optimistic update
    setTakeaways((prev) =>
      prev.map((t) => ({
        ...t,
        recommendations: t.recommendations?.map((r) =>
          r.id === id ? { ...r, text: value, source: "AI_HUMAN" } : r,
        ),
      })),
    );

    try {
      const res = await updateTakeawayRecommendationAction(
        id,
        value,
        studyId,
      );
      if (!res.success) {
        toast.error(res.error);
        setTakeaways(initialTakeaways); // Revert on failure
      } else {
        toast.success("Recommendation updated");
      }
    } catch (error) {
      toast.error("Failed to update recommendation");
      setTakeaways(initialTakeaways); // Revert on failure
    } finally {
      setSavingFields((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    // Optimistic UI update
    setTakeaways((prev) =>
      prev.map((t) => ({
        ...t,
        recommendations: t.recommendations.filter((r) => r.id !== id),
      }))
    );
    setHasLocalEdits(true);

    try {
      const res = await deleteTakeawayRecommendationAction(id, studyId);
      if (!res.success) {
        toast.error(res.error);
        setTakeaways(initialTakeaways); // Revert on failure
      } else {
        toast.success("Recommendation deleted");
      }
    } catch (error) {
      toast.error("Failed to delete recommendation");
      setTakeaways(initialTakeaways); // Revert on failure
    }
  };
  const handleStartAddRecommendation = (takeawayId: string) => {
    setAddingRecForTakeaway(takeawayId);
    setNewRecText("");
    // Ensure the card is expanded
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.add(takeawayId);
      return next;
    });
    // Focus the textarea after render
    setTimeout(() => newRecTextareaRef.current?.focus(), 50);
  };

  const handleSaveNewRecommendation = async () => {
    const takeawayId = addingRecForTakeaway;
    const text = newRecText.trim();
    if (!takeawayId || !text) return;

    setIsSavingNewRec(true);
    try {
      const res = await createTakeawayRecommendationAction(takeawayId, text, studyId);
      if (!res.success) {
        toast.error(res.error);
      } else {
        const newRec = res.data!;
        // Optimistic: append to local state
        setTakeaways((prev) =>
          prev.map((t) =>
            t.id === takeawayId
              ? {
                  ...t,
                  recommendations: [
                    ...t.recommendations,
                    { id: newRec.id, sortOrder: newRec.sortOrder, text: newRec.text, source: newRec.source },
                  ],
                }
              : t,
          ),
        );
        setHasLocalEdits(true);
        toast.success("Recommendation added");
        setAddingRecForTakeaway(null);
        setNewRecText("");
      }
    } catch (error) {
      toast.error("Failed to add recommendation");
    } finally {
      setIsSavingNewRec(false);
    }
  };

  const handleCancelNewRecommendation = () => {
    setAddingRecForTakeaway(null);
    setNewRecText("");
  };

  const handleAddTakeaway = async () => {
    try {
      const res = await createStudyTakeawayAction(studyId, {
        title: "New takeaway",
        description: "",
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const newTakeaway = res.data!;
      setTakeaways((prev) => [
        ...prev,
        {
          id: newTakeaway.id,
          sortOrder: newTakeaway.sortOrder,
          title: newTakeaway.title,
          description: newTakeaway.description,
          source: newTakeaway.source,
          recommendations: newTakeaway.recommendations || [],
        },
      ]);
      setHasLocalEdits(true);
      toast.success("Takeaway added");
    } catch (error) {
      toast.error("Failed to add takeaway");
    }
  };

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isCompleted = tldrStatus === "COMPLETED" && takeaways.length > 0;
  const isGeneratingStatus = tldrStatus === "GENERATING";
  const isPending = tldrStatus === "PENDING" || tldrStatus === "FAILED";

  // Polling for GENERATING status
  const pollTldrStatus = useCallback(async () => {
    try {
      const data = await getStudyTldrStatus(studyId, userId);
      if (!data) return;

      setTldrStatus(data.tldrStatus);

      if (data.tldrStatus === "COMPLETED" && data.takeaways?.length > 0) {
        setTakeaways(data.takeaways);
        setIsGenerating(false);
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (data.tldrStatus === "FAILED") {
        setIsGenerating(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      clientLogger.error("Failed to poll TLDR status", {
        error: error instanceof Error ? error.message : String(error),
        studyId,
      });
    }
  }, [studyId, userId]);

  useEffect(() => {
    if (isGeneratingStatus) {
      // Start polling every 15 seconds
      pollTldrStatus();
      intervalRef.current = setInterval(pollTldrStatus, 15000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isGeneratingStatus, pollTldrStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setTldrStatus("GENERATING");

    try {
      const result = await generateStudyTldr(studyId);
      if (!result.success) {
        toast.error(result.error || "Failed to generate TLDR");
        setTldrStatus("PENDING");
        setIsGenerating(false);
      }
      // On success, polling will pick up the status
    } catch (error) {
      clientLogger.error("Error generating TLDR", {
        error: error instanceof Error ? error.message : String(error),
        studyId,
      });
      toast.error("Failed to generate TLDR. Please try again.");
      setTldrStatus("PENDING");
      setIsGenerating(false);
    }
  };

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

  // ==========================================
  // Render: Generating state
  // ==========================================
  if (isGeneratingStatus || isGenerating) {
    return (
      <div className="mb-8">
        <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          Key Takeaways
        </h3>
        <div className="rounded-lg border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-4">
          <div className="flex items-center gap-3 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating takeaways…</span>
          </div>
          {/* Skeleton cards */}
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-md border border-zinc-100 bg-zinc-50 p-4"
              >
                <div className="mb-2 h-4 w-1/3 rounded bg-zinc-200" />
                <div className="h-3 w-2/3 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Completed state with takeaways
  // ==========================================
  if (isCompleted) {
    // Check if any item was edited by a human (from initial server props or optimistic local edits)
    const isEdited =
      hasLocalEdits ||
      takeaways.some(
        (t) =>
          t.source === "HUMAN" ||
          t.source === "AI_HUMAN" ||
          t.recommendations?.some(
            (r) => r.source === "HUMAN" || r.source === "AI_HUMAN",
          ),
      );

    return (
      <div className="mb-8">
        <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          Key Takeaways
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
                    className="group/takeaway rounded-md border border-zinc-100 bg-white p-4 relative"
                  >
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover/takeaway:opacity-100"
                        onClick={() => handleDeleteTakeaway(takeaway.id)}
                        disabled={Object.values(savingFields).some(Boolean)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <div className="flex items-start gap-3">
                      {/* Number badge */}
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1 pr-8">
                        <EditableField
                          value={takeaway.title}
                          canEdit={canManage}
                          isSaving={!!savingFields[`${takeaway.id}-title`]}
                          onSave={(val) => handleUpdateTakeaway(takeaway.id, "title", val)}
                          className="w-full"
                          textClassName="font-semibold leading-snug text-zinc-900"
                        />
                        <EditableField
                          value={takeaway.description}
                          canEdit={canManage}
                          isSaving={!!savingFields[`${takeaway.id}-description`]}
                          onSave={(val) => handleUpdateTakeaway(takeaway.id, "description", val)}
                          multiline
                          className="mt-1 w-full"
                          textClassName="text-sm leading-relaxed text-zinc-600"
                          placeholder="Add a description…"
                        />

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
                              {takeaway.recommendations.length} recommendation
                              {takeaway.recommendations.length !== 1
                                ? "s"
                                : ""}
                            </button>

                            {isExpanded && (
                              <>
                                <ul className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-3">
                                {takeaway.recommendations
                                  .sort((a, b) => a.sortOrder - b.sortOrder)
                                  .map((rec, recIndex) => (
                                    <li
                                      key={rec.id}
                                      className="group/rec relative text-sm leading-relaxed text-zinc-600"
                                    >
                                      <div className="flex items-start gap-2 pr-8">
                                        <span className="font-medium text-zinc-900 shrink-0 select-none">
                                          {String.fromCharCode(97 + recIndex)}.
                                        </span>
                                        <EditableField
                                          value={rec.text}
                                          canEdit={canManage}
                                          isSaving={!!savingFields[`rec-${rec.id}`]}
                                          onSave={(val) => handleUpdateRecommendation(rec.id, val)}
                                          multiline
                                          className="w-full"
                                        />
                                        
                                        {canManage && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-6 w-6 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover/rec:opacity-100"
                                            onClick={() => handleDeleteRecommendation(rec.id)}
                                            disabled={Object.values(savingFields).some(Boolean)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                              </ul>

                              {/* Inline add new recommendation */}
                              {addingRecForTakeaway === takeaway.id && (
                                <div className="mt-3 border-l-2 border-zinc-200 pl-3">
                                  <div className="flex items-start gap-2">
                                    <span className="font-medium text-zinc-900 shrink-0 select-none text-sm">
                                      {String.fromCharCode(97 + takeaway.recommendations.length)}.
                                    </span>
                                    <div className="flex-1">
                                      <textarea
                                        ref={newRecTextareaRef}
                                        value={newRecText}
                                        onChange={(e) => setNewRecText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSaveNewRecommendation();
                                          }
                                          if (e.key === "Escape") {
                                            handleCancelNewRecommendation();
                                          }
                                        }}
                                        placeholder="Type a recommendation…"
                                        className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                                        rows={2}
                                        disabled={isSavingNewRec}
                                      />
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={handleSaveNewRecommendation}
                                          disabled={!newRecText.trim() || isSavingNewRec}
                                        >
                                          {isSavingNewRec ? (
                                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</>
                                          ) : (
                                            "Save"
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs text-zinc-500"
                                          onClick={handleCancelNewRecommendation}
                                          disabled={isSavingNewRec}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Add recommendation button */}
                              {canManage && addingRecForTakeaway !== takeaway.id && (
                                <button
                                  onClick={() => handleStartAddRecommendation(takeaway.id)}
                                  className="mt-2 flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add recommendation
                                </button>
                              )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Add recommendation when no recommendations exist */}
                        {!hasRecommendations && canManage && (
                          <div className="mt-2">
                            {addingRecForTakeaway === takeaway.id ? (
                              <div className="border-l-2 border-zinc-200 pl-3">
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-zinc-900 shrink-0 select-none text-sm">
                                    a.
                                  </span>
                                  <div className="flex-1">
                                    <textarea
                                      ref={newRecTextareaRef}
                                      value={newRecText}
                                      onChange={(e) => setNewRecText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          handleSaveNewRecommendation();
                                        }
                                        if (e.key === "Escape") {
                                          handleCancelNewRecommendation();
                                        }
                                      }}
                                      placeholder="Type a recommendation…"
                                      className="w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                                      rows={2}
                                      disabled={isSavingNewRec}
                                    />
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={handleSaveNewRecommendation}
                                        disabled={!newRecText.trim() || isSavingNewRec}
                                      >
                                        {isSavingNewRec ? (
                                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</>
                                        ) : (
                                          "Save"
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-zinc-500"
                                        onClick={handleCancelNewRecommendation}
                                        disabled={isSavingNewRec}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartAddRecommendation(takeaway.id)}
                                className="flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                              >
                                <Plus className="h-3 w-3" />
                                Add recommendation
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-3 flex items-center justify-between">
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
              {isEdited ? "Generated by AI, edited by a human" : "Generated by AI"}
            </span>
            {canManage && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-zinc-500 hover:text-zinc-900"
                  onClick={handleAddTakeaway}
                >
                  <Plus className="mr-1.5 h-3 w-3" />
                  Add takeaway
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-zinc-500 hover:text-zinc-900"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCcw className="mr-1.5 h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Pending state — show generate button
  // ==========================================
  if (!canManage) return null; // Non-managers don't see the generate button

  return (
    <div className="mb-8">
      <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
        Key Takeaways
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-500">
          Generate AI-powered takeaways highlighting the most important findings
          and actionable recommendations.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          className="cursor-pointer gap-1.5 whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>
    </div>
  );
}
