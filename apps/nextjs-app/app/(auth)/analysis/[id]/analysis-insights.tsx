"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/apps/nextjs-app/components/ui/drawer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Check,
  Search,
  TriangleAlert,
  X,
  Bot,
  UserPen,
  UserPlus,
  Pencil,
  Loader2,
  Trash2,
  Plus,
  Music,
  Video,
  FileText,
  Quote,
} from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { toast } from "sonner";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";

interface AnalysisQuote {
  id: string;
  quote: string;
  participant?: string | null;
  sourceFileId?: string | null;
  timestamp?: string | null;
}

interface SourceFile {
  id: string;
  originalName?: string | null;
  fileType?: string | null;
  transcript?: string | null;
  identifier?: string | null;
}

interface AnalysisTag {
  id: string;
  tag: string;
}

interface AnalysisInsight {
  id: string;
  title: string;
  observation: string;
  motivation: string;
  implication: string;
  insightStatement: string;
  theme?: string | null;
  severity?: number | null;
  participantCount?: number | null;
  source: string;
  quotes: AnalysisQuote[];
  tags: AnalysisTag[];
  createdAt: string;
}

interface AnalysisInsightsProps {
  insights: AnalysisInsight[];
  studyId: string;
  canEdit: boolean;
  userId: string;
  updateInsight: (
    insightId: string,
    fields: {
      title?: string;
      observation?: string;
      motivation?: string;
      implication?: string;
      insightStatement?: string;
      severity?: number;
    },
    userId: string,
    studyId: string,
  ) => Promise<ActionResult>;
  deleteQuote: (
    quoteId: string,
    userId: string,
    studyId: string,
  ) => Promise<ActionResult>;
  addTag: (
    insightId: string,
    tag: string,
    userId: string,
    studyId: string,
  ) => Promise<ActionResult<{ id: string; tag: string }>>;
  removeTag: (
    tagId: string,
    userId: string,
    studyId: string,
  ) => Promise<ActionResult>;
  deleteInsight: (
    insightId: string,
    userId: string,
    studyId: string,
  ) => Promise<ActionResult>;
  addQuote: (
    insightId: string,
    quote: string,
    userId: string,
    studyId: string,
    participant?: string,
    sourceFileId?: string,
    timestamp?: string,
  ) => Promise<
    ActionResult<{
      id: string;
      quote: string;
      participant?: string | null;
      sourceFileId?: string | null;
      timestamp?: string | null;
    }>
  >;
  addInsight: (
    qualitativeAnalysisId: string,
    fields: {
      title: string;
      insightStatement: string;
      observation: string;
      motivation: string;
      implication: string;
      severity?: number;
    },
    userId: string,
    studyId: string,
    quotes?: { quote: string; participant?: string; sourceFileId?: string }[],
  ) => Promise<ActionResult<AnalysisInsight>>;
  qualitativeAnalysisId: string;
  sourceFiles: SourceFile[];
}

type InsightField =
  | "title"
  | "observation"
  | "motivation"
  | "implication"
  | "insightStatement"
  | "severity";

const MAX_QUOTE_LENGTH = 500;

const IMPACT_LEVELS = [
  {
    value: 1,
    label: "Low",
    dotColor: "bg-blue-400",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  {
    value: 2,
    label: "Moderate",
    dotColor: "bg-yellow-400",
    badgeColor: "bg-yellow-100 text-yellow-800",
  },
  {
    value: 3,
    label: "Significant",
    dotColor: "bg-orange-400",
    badgeColor: "bg-orange-100 text-orange-800",
  },
  {
    value: 4,
    label: "High",
    dotColor: "bg-red-400",
    badgeColor: "bg-red-100 text-red-800",
  },
  {
    value: 5,
    label: "Critical",
    dotColor: "bg-red-600",
    badgeColor: "bg-red-200 text-red-900",
  },
];

function ImpactBadge({
  severity,
  canEdit,
  isSaving,
  onSelect,
}: {
  severity: number;
  canEdit?: boolean;
  isSaving?: boolean;
  onSelect?: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const level =
    IMPACT_LEVELS[Math.min(severity - 1, IMPACT_LEVELS.length - 1)] ||
    IMPACT_LEVELS[0];

  if (!canEdit || !onSelect) {
    return <Badge className={level.badgeColor}>{level.label}</Badge>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Badge
            className={cn(
              level.badgeColor,
              "transition-opacity hover:opacity-80",
            )}
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            {level.label}
          </Badge>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-1"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {IMPACT_LEVELS.map((impactLevel) => (
                <CommandItem
                  key={impactLevel.value}
                  onSelect={() => {
                    if (impactLevel.value !== severity) {
                      onSelect(impactLevel.value);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        impactLevel.dotColor,
                      )}
                    />
                    <span>{impactLevel.label}</span>
                  </div>
                  {impactLevel.value === severity && (
                    <Check className="ml-auto h-3.5 w-3.5" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SourceLabel({ source }: { source: string }) {
  switch (source) {
    case "AI":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Bot className="h-3.5 w-3.5" />
          Generated by AI
        </span>
      );
    case "AI_HUMAN":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <UserPen className="h-3.5 w-3.5" />
          Generated by AI, edited by a human
        </span>
      );
    case "HUMAN":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <UserPlus className="h-3.5 w-3.5" />
          Created by a human
        </span>
      );
    default:
      return null;
  }
}

function EditableField({
  value,
  canEdit,
  onSave,
  isSaving,
  className,
  textClassName,
  multiline = false,
}: {
  value: string;
  canEdit: boolean;
  onSave: (newValue: string) => void;
  isSaving: boolean;
  className?: string;
  textClassName?: string;
  multiline?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
      }
    }
  }, [isEditing, multiline]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed === value) {
      setIsEditing(false);
      return;
    }
    onSave(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && !multiline) handleSave();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  };

  if (isEditing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full resize-none rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
            rows={2}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
          />
        )}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/field relative",
        canEdit && "cursor-pointer",
        className,
      )}
      onClick={() => {
        if (!canEdit) return;
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        setIsEditing(true);
      }}
    >
      <span className={textClassName}>{value}</span>
      {canEdit && (
        <Pencil className="ml-1.5 inline h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover/field:opacity-100" />
      )}
    </div>
  );
}

export function AnalysisInsights({
  insights,
  canEdit,
  userId,
  studyId,
  updateInsight,
  deleteQuote,
  addTag,
  removeTag,
  deleteInsight,
  addQuote,
  addInsight,
  qualitativeAnalysisId,
  sourceFiles,
}: AnalysisInsightsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImpacts, setSelectedImpacts] = useState<number[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [removedQuoteIds, setRemovedQuoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [addingTagInsightId, setAddingTagInsightId] = useState<string | null>(
    null,
  );
  const [newTagValue, setNewTagValue] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [removedTagIds, setRemovedTagIds] = useState<Set<string>>(new Set());
  const [addedTags, setAddedTags] = useState<
    Record<string, { id: string; tag: string }[]>
  >({});
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [confirmDeleteInsightId, setConfirmDeleteInsightId] = useState<
    string | null
  >(null);
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(
    null,
  );
  const [removedInsightIds, setRemovedInsightIds] = useState<Set<string>>(
    new Set(),
  );
  const [addQuoteInsightId, setAddQuoteInsightId] = useState<string | null>(
    null,
  );
  const [quoteSegments, setQuoteSegments] = useState<
    { text: string; start: number; end: number }[]
  >([]);
  const [quoteParticipant, setQuoteParticipant] = useState("");
  const [quoteSourceFileId, setQuoteSourceFileId] = useState<string | null>(
    null,
  );
  const [savingQuote, setSavingQuote] = useState(false);
  const [addedQuotes, setAddedQuotes] = useState<
    Record<string, AnalysisQuote[]>
  >({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // New insight state
  const [showNewInsightDrawer, setShowNewInsightDrawer] = useState(false);
  const [newInsightStep, setNewInsightStep] = useState<"quotes" | "fields">(
    "quotes",
  );
  const [newInsightQuotes, setNewInsightQuotes] = useState<
    { text: string; participant: string; sourceFileId: string | null }[]
  >([]);
  const [niQuoteSegments, setNiQuoteSegments] = useState<
    { text: string; start: number; end: number }[]
  >([]);
  const [niQuoteParticipant, setNiQuoteParticipant] = useState("");
  const [niQuoteSourceFileId, setNiQuoteSourceFileId] = useState<string | null>(
    null,
  );
  const [niActiveFileId, setNiActiveFileId] = useState<string | null>(null);
  const [newInsightFields, setNewInsightFields] = useState({
    title: "",
    insightStatement: "",
    observation: "",
    motivation: "",
    implication: "",
    severity: null as number | null,
  });
  const [savingNewInsight, setSavingNewInsight] = useState(false);
  const [addedInsights, setAddedInsights] = useState<AnalysisInsight[]>([]);

  // Map of fileId → participant label (manual overrides or remembered from last entry)
  const [fileParticipantMap, setFileParticipantMap] = useState<
    Record<string, string>
  >({});

  /** Get the best participant label for a file: manual override > AI-extracted identifier > empty */
  const getParticipantForFile = useCallback(
    (fileId: string | null): string => {
      if (!fileId) return "";
      if (fileParticipantMap[fileId]) return fileParticipantMap[fileId];
      const file = sourceFiles.find((f) => f.id === fileId);
      return file?.identifier || "";
    },
    [fileParticipantMap, sourceFiles],
  );

  /** Remember the participant label for a file */
  const rememberParticipant = useCallback(
    (fileId: string | null, participant: string) => {
      if (!fileId || !participant.trim()) return;
      setFileParticipantMap((prev) => ({
        ...prev,
        [fileId]: participant.trim(),
      }));
    },
    [],
  );

  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitleId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingTitleId]);

  useEffect(() => {
    if (addingTagInsightId && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [addingTagInsightId]);

  // Track local overrides for edited insight fields
  const [insightOverrides, setInsightOverrides] = useState<
    Record<string, Partial<AnalysisInsight>>
  >({});

  const getInsightValue = useCallback(
    (insight: AnalysisInsight, field: InsightField) => {
      return (
        (insightOverrides[insight.id]?.[field] as string) ?? insight[field]
      );
    },
    [insightOverrides],
  );

  const getInsightSource = useCallback(
    (insight: AnalysisInsight) => {
      return (insightOverrides[insight.id]?.source as string) ?? insight.source;
    },
    [insightOverrides],
  );

  const composedQuoteText = useMemo(
    () => quoteSegments.map((s) => s.text).join(" ... "),
    [quoteSegments],
  );

  const niComposedQuoteText = useMemo(
    () => niQuoteSegments.map((s) => s.text).join(" ... "),
    [niQuoteSegments],
  );

  const resetNewInsightDrawer = useCallback(() => {
    setShowNewInsightDrawer(false);
    setNewInsightStep("quotes");
    setNewInsightQuotes([]);
    setNiQuoteSegments([]);
    setNiQuoteParticipant("");
    setNiQuoteSourceFileId(null);
    setNiActiveFileId(null);
    setNewInsightFields({
      title: "",
      insightStatement: "",
      observation: "",
      motivation: "",
      implication: "",
      severity: null,
    });
  }, []);

  const handleAddNewInsightQuote = useCallback(() => {
    if (niQuoteSegments.length === 0) return;
    const composed = niQuoteSegments.map((s) => s.text).join(" ... ");
    // Remember participant for this file
    rememberParticipant(niQuoteSourceFileId, niQuoteParticipant);
    setNewInsightQuotes((prev) => [
      ...prev,
      {
        text: composed,
        participant: niQuoteParticipant.trim(),
        sourceFileId: niQuoteSourceFileId,
      },
    ]);
    setNiQuoteSegments([]);
    // Don't clear participant — keep it for the next quote from the same file
  }, [
    niQuoteSegments,
    niQuoteParticipant,
    niQuoteSourceFileId,
    rememberParticipant,
  ]);

  const handleSaveNewInsight = useCallback(async () => {
    const {
      title,
      insightStatement,
      observation,
      motivation,
      implication,
      severity,
    } = newInsightFields;
    if (!title.trim() || !insightStatement.trim()) return;
    setSavingNewInsight(true);
    try {
      const result = await addInsight(
        qualitativeAnalysisId,
        {
          title: title.trim(),
          insightStatement: insightStatement.trim(),
          observation: observation.trim(),
          motivation: motivation.trim(),
          implication: implication.trim(),
          ...(severity ? { severity } : {}),
        },
        userId,
        studyId,
        newInsightQuotes.length > 0
          ? newInsightQuotes.map((q) => ({
              quote: q.text,
              participant: q.participant || undefined,
              sourceFileId: q.sourceFileId || undefined,
            }))
          : undefined,
      );
      if (result.success && result.data) {
        setAddedInsights((prev) => [...prev, result.data!]);
        toast.success("Insight created");
        resetNewInsightDrawer();
      } else if (!result.success) {
        toast.error(result.error || "Failed to create insight");
      }
    } catch {
      toast.error("Failed to create insight");
    } finally {
      setSavingNewInsight(false);
    }
  }, [
    addInsight,
    qualitativeAnalysisId,
    newInsightFields,
    newInsightQuotes,
    userId,
    studyId,
    resetNewInsightDrawer,
  ]);

  const handleAddQuote = useCallback(async () => {
    if (!addQuoteInsightId || !composedQuoteText.trim()) return;
    setSavingQuote(true);
    // Remember the participant for this file
    rememberParticipant(quoteSourceFileId, quoteParticipant);
    try {
      const result = await addQuote(
        addQuoteInsightId,
        composedQuoteText.trim(),
        userId,
        studyId,
        quoteParticipant.trim() || undefined,
        quoteSourceFileId || undefined,
      );
      if (result.success && result.data) {
        setAddedQuotes((prev) => ({
          ...prev,
          [addQuoteInsightId]: [
            ...(prev[addQuoteInsightId] || []),
            result.data!,
          ],
        }));
        toast.success("Quote added");
        setAddQuoteInsightId(null);
        setQuoteSegments([]);
        setQuoteParticipant("");
        setQuoteSourceFileId(null);
      } else if (!result.success) {
        toast.error(result.error || "Failed to add quote");
      }
    } catch {
      toast.error("Failed to add quote");
    } finally {
      setSavingQuote(false);
    }
  }, [
    addQuote,
    addQuoteInsightId,
    composedQuoteText,
    quoteParticipant,
    quoteSourceFileId,
    userId,
    studyId,
    rememberParticipant,
  ]);

  const handleDeleteQuote = useCallback(
    async (quoteId: string) => {
      setDeletingQuoteId(quoteId);
      try {
        const result = await deleteQuote(quoteId, userId, studyId);
        if (result.success) {
          setRemovedQuoteIds((prev) => new Set(prev).add(quoteId));
          toast.success("Quote removed");
        } else {
          toast.error(result.error || "Failed to remove quote");
        }
      } catch {
        toast.error("Failed to remove quote");
      } finally {
        setDeletingQuoteId(null);
      }
    },
    [deleteQuote, userId, studyId],
  );

  const handleAddTag = useCallback(
    async (insightId: string, tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      setSavingTag(true);
      try {
        const result = await addTag(insightId, trimmed, userId, studyId);
        if (result.success) {
          setAddedTags((prev) => ({
            ...prev,
            [insightId]: [...(prev[insightId] || []), result.data],
          }));
          setNewTagValue("");
          setAddingTagInsightId(null);
          toast.success("Tag added");
        } else {
          toast.error(result.error || "Failed to add tag");
        }
      } catch {
        toast.error("Failed to add tag");
      } finally {
        setSavingTag(false);
      }
    },
    [addTag, userId, studyId],
  );

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      setRemovingTagId(tagId);
      try {
        const result = await removeTag(tagId, userId, studyId);
        if (result.success) {
          setRemovedTagIds((prev) => new Set(prev).add(tagId));
          toast.success("Tag removed");
        } else {
          toast.error(result.error || "Failed to remove tag");
        }
      } catch {
        toast.error("Failed to remove tag");
      } finally {
        setRemovingTagId(null);
      }
    },
    [removeTag, userId, studyId],
  );

  const handleDeleteInsight = useCallback(
    async (insightId: string) => {
      setDeletingInsightId(insightId);
      try {
        const result = await deleteInsight(insightId, userId, studyId);
        if (result.success) {
          setRemovedInsightIds((prev) => new Set(prev).add(insightId));
          setConfirmDeleteInsightId(null);
          toast.success("Insight removed");
        } else {
          toast.error(result.error || "Failed to remove insight");
        }
      } catch {
        toast.error("Failed to remove insight");
      } finally {
        setDeletingInsightId(null);
      }
    },
    [deleteInsight, userId, studyId],
  );

  const handleFieldSave = useCallback(
    async (
      insightId: string,
      field: InsightField,
      newValue: string | number,
    ) => {
      const fieldKey = `${insightId}-${field}`;
      setSavingField(fieldKey);
      try {
        const fieldPayload =
          field === "severity"
            ? { [field]: newValue as number }
            : { [field]: newValue as string };
        const result = await updateInsight(
          insightId,
          fieldPayload,
          userId,
          studyId,
        );
        if (result.success) {
          setInsightOverrides((prev) => ({
            ...prev,
            [insightId]: {
              ...prev[insightId],
              [field]: newValue,
              source: "AI_HUMAN",
            },
          }));
          toast.success("Insight updated");
        } else {
          toast.error(result.error || "Failed to update insight");
        }
      } catch {
        toast.error("Failed to update insight");
      } finally {
        setSavingField(null);
      }
    },
    [updateInsight, userId, studyId],
  );

  const hasActiveFilters =
    selectedImpacts.length > 0 ||
    selectedTheme !== null ||
    selectedTag !== null;

  // Filter insights (merge in newly added insights, deduplicate)
  const allInsights = useMemo(() => {
    const existingIds = new Set(insights.map((i) => i.id));
    const newOnes = addedInsights.filter((i) => !existingIds.has(i.id));
    return [...insights, ...newOnes];
  }, [insights, addedInsights]);

  // Collect all unique tag strings for autocomplete suggestions
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ins of allInsights) {
      for (const t of ins.tags) tagSet.add(t.tag);
    }
    // Include locally-added tags too
    for (const tags of Object.values(addedTags)) {
      for (const t of tags) tagSet.add(t.tag);
    }
    return Array.from(tagSet).sort();
  }, [allInsights, addedTags]);

  const filteredInsights = useMemo(() => {
    return allInsights.filter((insight) => {
      // Hide removed insights
      if (removedInsightIds.has(insight.id)) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          insight.title.toLowerCase().includes(q) ||
          insight.observation.toLowerCase().includes(q) ||
          insight.motivation.toLowerCase().includes(q) ||
          insight.implication.toLowerCase().includes(q) ||
          insight.insightStatement.toLowerCase().includes(q) ||
          insight.quotes.some((qte) => qte.quote.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Impact filter
      if (selectedImpacts.length > 0) {
        const effectiveSeverity =
          (insightOverrides[insight.id]?.severity as number | undefined) ??
          insight.severity;
        if (!effectiveSeverity || !selectedImpacts.includes(effectiveSeverity))
          return false;
      }

      // Theme filter
      if (selectedTheme && insight.theme !== selectedTheme) return false;

      // Tag filter
      if (selectedTag && !insight.tags.some((t) => t.tag === selectedTag))
        return false;

      return true;
    });
  }, [
    allInsights,
    searchQuery,
    selectedImpacts,
    selectedTheme,
    selectedTag,
    removedInsightIds,
    insightOverrides,
  ]);

  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No insights have been extracted yet. The analysis may still be
          processing.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Key Insights
        </h3>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-1">
            <span className="text-4xl text-zinc-500">
              {allInsights.length - removedInsightIds.size}
            </span>
            <span className="text-zinc-500">
              {allInsights.length - removedInsightIds.size === 1
                ? "insight"
                : "insights"}
            </span>
          </span>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const initialFileId = sourceFiles[0]?.id || null;
                setShowNewInsightDrawer(true);
                setNewInsightStep("quotes");
                setNiActiveFileId(initialFileId);
                setNiQuoteParticipant(getParticipantForFile(initialFileId));
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Insight
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Search insights, quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Impact/Severity Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8 gap-1.5">
              <TriangleAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Impact</span>
              {selectedImpacts.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
                  <div className="flex gap-1">
                    {selectedImpacts.length <= 2 ? (
                      selectedImpacts.map((level) => {
                        const info = IMPACT_LEVELS.find(
                          (l) => l.value === level,
                        );
                        return (
                          <Badge
                            key={level}
                            variant="secondary"
                            className="rounded-sm px-1 font-normal"
                          >
                            {info?.label}
                          </Badge>
                        );
                      })
                    ) : (
                      <Badge
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {selectedImpacts.length} selected
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {IMPACT_LEVELS.map((option) => {
                    const isSelected = selectedImpacts.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => {
                          setSelectedImpacts(
                            isSelected
                              ? selectedImpacts.filter(
                                  (s) => s !== option.value,
                                )
                              : [...selectedImpacts, option.value],
                          );
                        }}
                      >
                        <div
                          className={cn(
                            "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <div
                          className={cn(
                            "mr-2 h-2.5 w-2.5 rounded-full",
                            option.dotColor,
                          )}
                        />
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Active Theme/Tag Filters */}
        {(selectedTheme || selectedTag) && (
          <div className="flex items-center gap-1">
            {selectedTheme && (
              <Badge
                variant="default"
                className="cursor-pointer gap-1"
                onClick={() => setSelectedTheme(null)}
              >
                {selectedTheme}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {selectedTag && (
              <Badge
                variant="default"
                className="cursor-pointer gap-1"
                onClick={() => setSelectedTag(null)}
              >
                {selectedTag}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={() => {
              setSelectedImpacts([]);
              setSelectedTheme(null);
              setSelectedTag(null);
            }}
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Insight Accordions */}
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={insights.map((i) => i.id)}
      >
        {filteredInsights.map((insight) => (
          <AccordionItem key={insight.id} value={insight.id}>
            <AccordionTrigger sticky className="hover:no-underline">
              <div className="group/trigger flex w-full items-center justify-between gap-4">
                {editingTitleId === insight.id ? (
                  <div
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditingTitleId(null);
                        }
                        if (e.key === "Enter") {
                          const trimmed = editingTitleValue.trim();
                          if (trimmed !== getInsightValue(insight, "title")) {
                            handleFieldSave(insight.id, "title", trimmed);
                          }
                          setEditingTitleId(null);
                        }
                      }}
                      disabled={savingField === `${insight.id}-title`}
                      className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium focus:border-zinc-400 focus:outline-none"
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                      onClick={() => {
                        const trimmed = editingTitleValue.trim();
                        if (trimmed !== getInsightValue(insight, "title")) {
                          handleFieldSave(insight.id, "title", trimmed);
                        }
                        setEditingTitleId(null);
                      }}
                    >
                      {savingField === `${insight.id}-title` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                      onClick={() => setEditingTitleId(null)}
                    >
                      <X className="h-4 w-4" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-left font-medium">
                      {getInsightValue(insight, "title")}
                    </span>
                    {canEdit && (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          className="hover:bg-accent hover:text-accent-foreground inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-0 transition-opacity group-hover/trigger:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleValue(
                              getInsightValue(insight, "title"),
                            );
                            setEditingTitleId(insight.id);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity group-hover/trigger:opacity-100 hover:bg-red-50 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteInsightId(insight.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-4">
                  {(() => {
                    const visibleQuotes = [
                      ...insight.quotes.filter(
                        (q) => !removedQuoteIds.has(q.id),
                      ),
                      ...(addedQuotes[insight.id] || []).filter(
                        (q) =>
                          !removedQuoteIds.has(q.id) &&
                          !insight.quotes.some((eq) => eq.id === q.id),
                      ),
                    ];
                    const uniqueSourceFiles = new Set(
                      visibleQuotes.map((q) => q.sourceFileId).filter(Boolean),
                    );
                    const count = uniqueSourceFiles.size;
                    return count > 0 ? (
                      <div className="flex flex-col text-sm text-zinc-500">
                        <span className="font-semibold">{count}</span>
                        <span className="text-xs">
                          {count === 1 ? "participant" : "participants"}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {insight.quotes.filter((q) => !removedQuoteIds.has(q.id))
                    .length > 0 && (
                    <div className="flex flex-col text-sm text-zinc-500">
                      <span className="font-semibold">
                        {
                          insight.quotes.filter(
                            (q) => !removedQuoteIds.has(q.id),
                          ).length
                        }
                      </span>
                      <span className="text-xs">
                        {insight.quotes.filter(
                          (q) => !removedQuoteIds.has(q.id),
                        ).length === 1
                          ? "quote"
                          : "quotes"}
                      </span>
                    </div>
                  )}
                  {(insightOverrides[insight.id]?.severity ??
                  insight.severity) ? (
                    <ImpactBadge
                      severity={
                        (insightOverrides[insight.id]?.severity as number) ??
                        insight.severity!
                      }
                      canEdit={canEdit}
                      isSaving={savingField === `${insight.id}-severity`}
                      onSelect={(value) =>
                        handleFieldSave(insight.id, "severity", value)
                      }
                    />
                  ) : null}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="flex flex-col gap-4">
                {/* Insight Statement */}
                <EditableField
                  value={getInsightValue(insight, "insightStatement")}
                  canEdit={canEdit}
                  onSave={(v) =>
                    handleFieldSave(insight.id, "insightStatement", v)
                  }
                  isSaving={savingField === `${insight.id}-insightStatement`}
                  multiline
                  textClassName="text-sm font-medium italic"
                />

                {/* Three Pillars */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <h5 className="mb-1 text-xs font-semibold tracking-wide uppercase">
                      Observation
                    </h5>
                    <EditableField
                      value={getInsightValue(insight, "observation")}
                      canEdit={canEdit}
                      onSave={(v) =>
                        handleFieldSave(insight.id, "observation", v)
                      }
                      isSaving={savingField === `${insight.id}-observation`}
                      multiline
                      textClassName="text-muted-foreground text-sm"
                    />
                  </div>
                  <div className="rounded-md border p-3">
                    <h5 className="mb-1 text-xs font-semibold tracking-wide uppercase">
                      Motivation
                    </h5>
                    <EditableField
                      value={getInsightValue(insight, "motivation")}
                      canEdit={canEdit}
                      onSave={(v) =>
                        handleFieldSave(insight.id, "motivation", v)
                      }
                      isSaving={savingField === `${insight.id}-motivation`}
                      multiline
                      textClassName="text-muted-foreground text-sm"
                    />
                  </div>
                  <div className="rounded-md border p-3">
                    <h5 className="mb-1 text-xs font-semibold tracking-wide uppercase">
                      Implication
                    </h5>
                    <EditableField
                      value={getInsightValue(insight, "implication")}
                      canEdit={canEdit}
                      onSave={(v) =>
                        handleFieldSave(insight.id, "implication", v)
                      }
                      isSaving={savingField === `${insight.id}-implication`}
                      multiline
                      textClassName="text-muted-foreground text-sm"
                    />
                  </div>
                </div>

                {/* Quotes */}
                {(() => {
                  const existingQuotes = insight.quotes.filter(
                    (q) => !removedQuoteIds.has(q.id),
                  );
                  const existingIds = new Set(existingQuotes.map((q) => q.id));
                  const added = (addedQuotes[insight.id] || []).filter(
                    (q) => !removedQuoteIds.has(q.id) && !existingIds.has(q.id),
                  );
                  const allQuotes = [...existingQuotes, ...added];
                  const hasQuotes = allQuotes.length > 0;

                  return hasQuotes || (canEdit && sourceFiles.length > 0) ? (
                    <div>
                      <h5 className="mb-2 text-sm font-semibold">Quotes</h5>
                      <div className="relative overflow-hidden">
                        <div
                          className="quotes-scroll flex gap-3 overflow-x-auto pb-2"
                          style={{
                            scrollbarWidth: "none",
                            maskImage:
                              "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
                            WebkitMaskImage:
                              "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
                          }}
                          onScroll={(e) => {
                            const el = e.currentTarget;
                            const atStart = el.scrollLeft < 4;
                            const atEnd =
                              el.scrollLeft + el.clientWidth >=
                              el.scrollWidth - 4;
                            // Remove fade on the side that's at the edge
                            if (atStart && atEnd) {
                              el.style.maskImage = "none";
                              el.style.webkitMaskImage = "none";
                            } else if (atStart) {
                              el.style.maskImage =
                                "linear-gradient(to right, black, black calc(100% - 48px), transparent)";
                              el.style.webkitMaskImage =
                                "linear-gradient(to right, black, black calc(100% - 48px), transparent)";
                            } else if (atEnd) {
                              el.style.maskImage =
                                "linear-gradient(to right, transparent, black 48px, black)";
                              el.style.webkitMaskImage =
                                "linear-gradient(to right, transparent, black 48px, black)";
                            } else {
                              el.style.maskImage =
                                "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)";
                              el.style.webkitMaskImage =
                                "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)";
                            }
                          }}
                          ref={(el) => {
                            // Set initial mask on mount based on overflow
                            if (!el) return;
                            requestAnimationFrame(() => {
                              const canScroll =
                                el.scrollWidth - el.clientWidth > 1;
                              if (!canScroll) {
                                el.style.maskImage = "none";
                                el.style.webkitMaskImage = "none";
                              } else {
                                // At start: only fade right
                                el.style.maskImage =
                                  "linear-gradient(to right, black, black calc(100% - 48px), transparent)";
                                el.style.webkitMaskImage =
                                  "linear-gradient(to right, black, black calc(100% - 48px), transparent)";
                              }
                            });
                          }}
                        >
                        {allQuotes.map((q) => (
                          <div
                            key={q.id}
                            className="group/quote relative w-64 shrink-0 rounded-md border bg-white p-3"
                          >
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-1 right-1 h-7 w-7 text-zinc-400 opacity-0 transition-opacity group-hover/quote:opacity-100 hover:text-red-500"
                                disabled={deletingQuoteId === q.id}
                                onClick={() => handleDeleteQuote(q.id)}
                              >
                                {deletingQuoteId === q.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                            <p
                              className="text-muted-foreground text-sm italic"
                              style={{
                                fontFamily: "Georgia, 'Times New Roman', serif",
                              }}
                            >
                              &ldquo;{q.quote}&rdquo;
                            </p>
                            {(q.participant || q.timestamp) && (
                              <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                                {q.participant && (
                                  <span className="font-medium">
                                    {q.participant}
                                  </span>
                                )}
                                {q.timestamp && (
                                  <span className="text-blue-600">
                                    @ {q.timestamp}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {canEdit && sourceFiles.length > 0 && (
                          <button
                            type="button"
                            className="flex w-64 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-500"
                            onClick={() => {
                              const initialFileId = sourceFiles[0]?.id || null;
                              setAddQuoteInsightId(insight.id);
                              setQuoteSegments([]);
                              setQuoteParticipant(
                                getParticipantForFile(initialFileId),
                              );
                              setQuoteSourceFileId(null);
                              setActiveFileId(initialFileId);
                            }}
                          >
                            <Plus className="h-8 w-8" />
                            <span className="text-xs font-medium">
                              Add Quote
                            </span>
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Theme & Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {insight.theme && (
                    <Badge
                      variant={
                        selectedTheme === insight.theme
                          ? "default"
                          : "secondary"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedTheme(
                          selectedTheme === insight.theme
                            ? null
                            : insight.theme!,
                        )
                      }
                    >
                      {insight.theme}
                    </Badge>
                  )}
                  {insight.tags
                    .filter((tag) => !removedTagIds.has(tag.id))
                    .map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={
                          selectedTag === tag.tag ? "default" : "outline"
                        }
                        className="group/tag cursor-pointer gap-1 text-xs"
                        onClick={() =>
                          setSelectedTag(
                            selectedTag === tag.tag ? null : tag.tag,
                          )
                        }
                      >
                        {tag.tag}
                        {canEdit && (
                          <span
                            role="button"
                            className="ml-0.5 inline-flex items-center rounded-full opacity-0 transition-opacity group-hover/tag:opacity-100 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTag(tag.id);
                            }}
                          >
                            {removingTagId === tag.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </Badge>
                    ))}
                  {(addedTags[insight.id] || [])
                    .filter(
                      (tag) =>
                        !insight.tags.some((t) => t.id === tag.id) &&
                        !removedTagIds.has(tag.id),
                    )
                    .map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={
                          selectedTag === tag.tag ? "default" : "outline"
                        }
                        className="group/tag cursor-pointer gap-1 text-xs"
                        onClick={() =>
                          setSelectedTag(
                            selectedTag === tag.tag ? null : tag.tag,
                          )
                        }
                      >
                        {tag.tag}
                        {canEdit && (
                          <span
                            role="button"
                            className="ml-0.5 inline-flex items-center rounded-full opacity-0 transition-opacity group-hover/tag:opacity-100 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTag(tag.id);
                            }}
                          >
                            {removingTagId === tag.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </Badge>
                    ))}
                  {canEdit &&
                    (addingTagInsightId === insight.id ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          <input
                            ref={newTagInputRef}
                            type="text"
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setAddingTagInsightId(null);
                                setNewTagValue("");
                              }
                              if (e.key === "Enter") {
                                handleAddTag(insight.id, newTagValue);
                              }
                              // Arrow-key navigation for suggestions
                              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                e.preventDefault();
                                const container = e.currentTarget.parentElement?.querySelector(
                                  "[data-tag-suggestions]"
                                );
                                if (container) {
                                  const items = container.querySelectorAll("button");
                                  if (items.length > 0) {
                                    const focused = container.querySelector("button:focus");
                                    const idx = focused ? Array.from(items).indexOf(focused as HTMLButtonElement) : -1;
                                    const next = e.key === "ArrowDown"
                                      ? items[Math.min(idx + 1, items.length - 1)]
                                      : items[Math.max(idx - 1, 0)];
                                    (next as HTMLElement)?.focus();
                                  }
                                }
                              }
                            }}
                            disabled={savingTag}
                            placeholder="New tag..."
                            className="h-6 w-32 rounded border border-zinc-300 px-2 text-xs focus:border-zinc-400 focus:outline-none"
                          />
                          {/* Tag suggestions dropdown */}
                          {newTagValue.trim().length > 0 && (() => {
                            const currentInsightTags = new Set([
                              ...insight.tags.filter((t) => !removedTagIds.has(t.id)).map((t) => t.tag),
                              ...(addedTags[insight.id] || []).map((t) => t.tag),
                            ]);
                            const suggestions = allUniqueTags.filter(
                              (t) =>
                                t.toLowerCase().includes(newTagValue.trim().toLowerCase()) &&
                                !currentInsightTags.has(t)
                            );
                            return suggestions.length > 0 ? (
                              <div
                                data-tag-suggestions
                                className="absolute bottom-full left-0 z-50 mb-1 max-h-32 w-40 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
                              >
                                {suggestions.slice(0, 8).map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    className="w-full px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none"
                                    onMouseDown={(e) => {
                                      e.preventDefault(); // prevent input blur
                                      handleAddTag(insight.id, suggestion);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddTag(insight.id, suggestion);
                                      }
                                      if (e.key === "Escape") {
                                        setAddingTagInsightId(null);
                                        setNewTagValue("");
                                      }
                                    }}
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5"
                          disabled={savingTag || !newTagValue.trim()}
                          onClick={() => handleAddTag(insight.id, newTagValue)}
                        >
                          {savingTag ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5"
                          onClick={() => {
                            setAddingTagInsightId(null);
                            setNewTagValue("");
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer gap-1 border-dashed text-xs text-zinc-400 hover:text-zinc-600"
                        onClick={() => {
                          setAddingTagInsightId(insight.id);
                          setNewTagValue("");
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Add tag
                      </Badge>
                    ))}
                </div>

                {/* Source */}
                <SourceLabel source={getInsightSource(insight)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {filteredInsights.length === 0 && allInsights.length > 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No insights match your current filters.
          </p>
        </div>
      )}

      {/* Delete Insight Confirmation Dialog */}
      <Dialog
        open={confirmDeleteInsightId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteInsightId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete insight</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this insight? This will
              permanently remove the insight along with all its quotes, tags,
              and related data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteInsightId(null)}
              disabled={deletingInsightId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteInsightId) {
                  handleDeleteInsight(confirmDeleteInsightId);
                }
              }}
              disabled={deletingInsightId !== null}
            >
              {deletingInsightId !== null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quote Drawer */}
      <Drawer
        direction="right"
        handleOnly
        open={addQuoteInsightId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddQuoteInsightId(null);
            setQuoteSegments([]);
            setQuoteParticipant("");
            setQuoteSourceFileId(null);
          }
        }}
      >
        <DrawerContent direction="right">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>Add quote from source</DrawerTitle>
            <DrawerDescription>
              Select text from a source file to add as a quote.
            </DrawerDescription>

          </DrawerHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            {sourceFiles.length > 0 && (
              <>
                {/* File tabs */}
                {sourceFiles.length > 1 && (
                  <div
                    className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {sourceFiles.map((file) => {
                      const type = (file.fileType || "").toUpperCase();
                      const IconComponent =
                        type === "AUDIO"
                          ? Music
                          : type === "VIDEO"
                            ? Video
                            : FileText;
                      const isLocked =
                        quoteSegments.length > 0 &&
                        quoteSourceFileId !== null &&
                        quoteSourceFileId !== file.id;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          disabled={isLocked}
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            activeFileId === file.id
                              ? "bg-zinc-900 text-white"
                              : isLocked
                                ? "cursor-not-allowed text-zinc-300"
                                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
                          )}
                          onClick={() => {
                            setActiveFileId(file.id);
                            setQuoteParticipant(getParticipantForFile(file.id));
                          }}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                          <span className="max-w-28 truncate">
                            {file.originalName || "Untitled"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Transcript content */}
                {(() => {
                  const activeFile =
                    sourceFiles.find((f) => f.id === activeFileId) ||
                    sourceFiles[0];
                  if (!activeFile?.transcript) {
                    return (
                      <div className="mx-4 mt-3 flex h-48 items-center justify-center rounded-md border bg-zinc-50 text-sm text-zinc-400">
                        No transcript available for this file.
                      </div>
                    );
                  }
                  return (
                    <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 py-3">
                      <div className="flex shrink-0 items-center justify-between">
                        <p className="text-xs text-zinc-400">
                          Highlight text to select. Hold{" "}
                          <kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-600">
                            ⌘
                          </kbd>{" "}
                          for multiple selections.
                        </p>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            composedQuoteText.length > MAX_QUOTE_LENGTH
                              ? "font-medium text-red-500"
                              : "text-zinc-400",
                          )}
                        >
                          {composedQuoteText.length}/{MAX_QUOTE_LENGTH}
                        </span>
                      </div>
                      <div
                        className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-white p-4 text-sm leading-relaxed select-text"
                        onMouseUp={(e) => {
                          const selection = window.getSelection();
                          if (
                            selection &&
                            selection.rangeCount > 0 &&
                            selection.toString().trim().length > 0
                          ) {
                            const text = selection.toString().trim();
                            const range = selection.getRangeAt(0);
                            // Calculate the character offset within the transcript
                            const container = e.currentTarget;
                            const preRange = document.createRange();
                            preRange.selectNodeContents(container);
                            preRange.setEnd(
                              range.startContainer,
                              range.startOffset,
                            );
                            const startOffset = preRange.toString().length;
                            // Adjust for leading whitespace trimmed from selection
                            const rawText = selection.toString();
                            const leadingTrimmed =
                              rawText.length - rawText.trimStart().length;
                            const adjustedStart = startOffset + leadingTrimmed;
                            const adjustedEnd = adjustedStart + text.length;

                            // Block selections that fall within a same-insight quote
                            const transcript = activeFile.transcript || "";
                            const currentInsight = allInsights.find(
                              (ins) => ins.id === addQuoteInsightId,
                            );
                            if (currentInsight) {
                              const sameInsightQuotes = currentInsight.quotes.filter(
                                (q) =>
                                  !removedQuoteIds.has(q.id) &&
                                  (!q.sourceFileId || q.sourceFileId === activeFile.id),
                              );
                              for (const q of sameInsightQuotes) {
                                const idx = transcript.indexOf(q.quote);
                                if (idx === -1) continue;
                                const qEnd = idx + q.quote.length;
                                // Block if selected range is entirely within this same-insight quote
                                if (adjustedStart >= idx && adjustedEnd <= qEnd) {
                                  selection.removeAllRanges();
                                  toast.error(
                                    "This text is already quoted on this insight",
                                  );
                                  return;
                                }
                              }
                            }

                            const isMultiSelect = e.metaKey || e.ctrlKey;
                            // Check if selection overlaps an existing segment — if so, remove it (toggle off)
                            const existingSegments = isMultiSelect
                              ? quoteSegments
                              : [];
                            const overlappingIdx = existingSegments.findIndex(
                              (s) =>
                                adjustedStart < s.end && adjustedEnd > s.start,
                            );
                            if (overlappingIdx !== -1) {
                              setQuoteSegments((prev) =>
                                prev.filter((_, i) => i !== overlappingIdx),
                              );
                              selection.removeAllRanges();
                              return;
                            }
                            const newSegment = {
                              text,
                              start: adjustedStart,
                              end: adjustedEnd,
                            };
                            const newSegments = isMultiSelect
                              ? [...quoteSegments, newSegment].sort(
                                  (a, b) => a.start - b.start,
                                )
                              : [newSegment];
                            const newComposed = newSegments
                              .map((s) => s.text)
                              .join(" ... ");
                            if (newComposed.length <= MAX_QUOTE_LENGTH) {
                              setQuoteSegments(newSegments);
                              setQuoteSourceFileId(activeFile.id);
                            } else {
                              toast.error(
                                `Selection would exceed the ${MAX_QUOTE_LENGTH} character limit (${newComposed.length}/${MAX_QUOTE_LENGTH})`,
                              );
                            }
                            selection.removeAllRanges();
                          } else if (!(e.metaKey || e.ctrlKey)) {
                            setQuoteSegments([]);
                          }
                        }}
                      >
                        <p className="whitespace-pre-wrap">
                          {(() => {
                            const transcript = activeFile.transcript || "";

                            // Build highlight spans for existing quotes
                            type HighlightSpan = {
                              start: number;
                              end: number;
                              type: "same-insight" | "other-insight" | "selection";
                            };
                            const existingHighlights: HighlightSpan[] = [];

                            for (const ins of allInsights) {
                              if (removedInsightIds.has(ins.id)) continue;
                              const isSame = ins.id === addQuoteInsightId;
                              for (const q of ins.quotes) {
                                if (removedQuoteIds.has(q.id)) continue;
                                // Only highlight quotes that belong to this file (or have no sourceFileId)
                                if (q.sourceFileId && q.sourceFileId !== activeFile.id)
                                  continue;
                                const idx = transcript.indexOf(q.quote);
                                if (idx === -1) continue;
                                existingHighlights.push({
                                  start: idx,
                                  end: idx + q.quote.length,
                                  type: isSame ? "same-insight" : "other-insight",
                                });
                              }
                            }

                            // Add user selection highlights
                            const selectionHighlights: HighlightSpan[] =
                              quoteSegments
                                .filter(
                                  (seg) =>
                                    seg.start >= 0 &&
                                    seg.end <= transcript.length,
                                )
                                .map((seg) => ({
                                  start: seg.start,
                                  end: seg.end,
                                  type: "selection" as const,
                                }));

                            const allHighlights = [
                              ...existingHighlights,
                              ...selectionHighlights,
                            ].sort((a, b) => a.start - b.start);

                            if (allHighlights.length === 0) return transcript;

                            // Merge overlapping highlights, prioritizing: selection > same-insight > other-insight
                            const priorityOf = (
                              type: HighlightSpan["type"],
                            ) =>
                              type === "selection"
                                ? 3
                                : type === "same-insight"
                                  ? 2
                                  : 1;

                            // Build character-level type map for overlapping regions
                            const charType = new Uint8Array(transcript.length); // 0=none, 1=other, 2=same, 3=selection
                            for (const h of allHighlights) {
                              const p = priorityOf(h.type);
                              for (
                                let i = Math.max(0, h.start);
                                i < Math.min(h.end, transcript.length);
                                i++
                              ) {
                                if (p > charType[i]) charType[i] = p;
                              }
                            }

                            // Convert char-level map to spans
                            const parts: React.ReactNode[] = [];
                            let cursor = 0;
                            while (cursor < transcript.length) {
                              const currentType = charType[cursor];
                              let end = cursor;
                              while (
                                end < transcript.length &&
                                charType[end] === currentType
                              )
                                end++;
                              const slice = transcript.slice(cursor, end);
                              if (currentType === 0) {
                                parts.push(slice);
                              } else {
                                const className =
                                  currentType === 3
                                    ? "rounded-sm bg-blue-100 px-0.5 text-blue-900"
                                    : currentType === 2
                                      ? "rounded-sm bg-amber-50 text-amber-800/70"
                                      : "rounded-sm bg-purple-50 text-purple-800/60";
                                parts.push(
                                  <mark key={cursor} className={className}>
                                    {slice}
                                  </mark>,
                                );
                              }
                              cursor = end;
                            }
                            return parts;
                          })()}
                        </p>
                      </div>
                      <div className="mt-1.5 flex shrink-0 flex-wrap gap-3 text-[11px]">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100" />
                          <span className="text-zinc-500">This insight</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-100" />
                          <span className="text-zinc-500">Other insights</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-100" />
                          <span className="text-zinc-500">Your selection</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Selected quote preview + participant — always visible at bottom */}
                <div className="flex shrink-0 flex-col gap-2.5 border-t px-4 py-3">
                  {quoteSegments.length > 0 ? (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Quote className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700">
                            {quoteSegments.length === 1
                              ? "Selected quote"
                              : `${quoteSegments.length} selections`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-blue-500 hover:text-blue-700"
                          onClick={() => setQuoteSegments([])}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="max-h-24 overflow-y-auto">
                        <p
                          className="text-sm text-blue-900 italic"
                          style={{
                            fontFamily: "Georgia, 'Times New Roman', serif",
                          }}
                        >
                          &ldquo;{quoteSegments.map((s) => s.text).join("... ")}
                          &rdquo;
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2">
                      <Quote className="h-3.5 w-3.5 text-zinc-300" />
                      <span className="text-xs text-zinc-400">
                        No text selected yet
                      </span>
                    </div>
                  )}

                  {/* Participant input */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="quote-participant"
                      className="shrink-0 text-xs font-medium text-zinc-500"
                    >
                      Participant (optional)
                    </label>
                    <Input
                      id="quote-participant"
                      value={quoteParticipant}
                      onChange={(e) => setQuoteParticipant(e.target.value)}
                      placeholder="e.g., P1, Participant A"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DrawerFooter className="shrink-0 border-t p-4">
            <div className="flex justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="ghost" disabled={savingQuote}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                onClick={handleAddQuote}
                disabled={
                  quoteSegments.length === 0 ||
                  composedQuoteText.length > MAX_QUOTE_LENGTH ||
                  savingQuote
                }
              >
                {savingQuote ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Quote
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* New Insight Drawer */}
      <Drawer
        direction="right"
        handleOnly
        open={showNewInsightDrawer}
        onOpenChange={(open) => {
          if (!open) resetNewInsightDrawer();
        }}
      >
        <DrawerContent direction="right">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle>
              {newInsightStep === "quotes" ? "Add quotes" : "Describe insight"}
            </DrawerTitle>
            <DrawerDescription>
              {newInsightStep === "quotes"
                ? "Select quotes from source files to support this insight. You can add multiple quotes."
                : "Fill in the insight details below."}
            </DrawerDescription>
            {/* Step indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  newInsightStep === "quotes"
                    ? "bg-zinc-900 text-white"
                    : "bg-emerald-500 text-white",
                )}
              >
                {newInsightStep === "quotes" ? (
                  "1"
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  newInsightStep === "quotes"
                    ? "font-medium text-zinc-900"
                    : "text-zinc-400",
                )}
              >
                Quotes
              </span>
              <div className="h-px w-4 bg-zinc-200" />
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  newInsightStep === "fields"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-200 text-zinc-500",
                )}
              >
                2
              </div>
              <span
                className={cn(
                  "text-xs",
                  newInsightStep === "fields"
                    ? "font-medium text-zinc-900"
                    : "text-zinc-400",
                )}
              >
                Details
              </span>
            </div>
          </DrawerHeader>

          {newInsightStep === "quotes" ? (
            <>
              <div className="flex flex-1 flex-col overflow-hidden">
                {sourceFiles.length > 0 ? (
                  <>
                    {/* File tabs */}
                    {sourceFiles.length > 1 && (
                      <div
                        className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2"
                        style={{ scrollbarWidth: "none" }}
                      >
                        {sourceFiles.map((file) => {
                          const type = (file.fileType || "").toUpperCase();
                          const IconComponent =
                            type === "AUDIO"
                              ? Music
                              : type === "VIDEO"
                                ? Video
                                : FileText;
                          const isLocked =
                            niQuoteSegments.length > 0 &&
                            niQuoteSourceFileId !== null &&
                            niQuoteSourceFileId !== file.id;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              disabled={isLocked}
                              className={cn(
                                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                (niActiveFileId || sourceFiles[0]?.id) ===
                                  file.id
                                  ? "bg-zinc-900 text-white"
                                  : isLocked
                                    ? "cursor-not-allowed text-zinc-300"
                                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
                              )}
                              onClick={() => {
                                setNiActiveFileId(file.id);
                                setNiQuoteParticipant(
                                  getParticipantForFile(file.id),
                                );
                              }}
                            >
                              <IconComponent className="h-3.5 w-3.5" />
                              <span className="max-w-28 truncate">
                                {file.originalName || "Untitled"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Transcript content */}
                    {(() => {
                      const activeFile =
                        sourceFiles.find(
                          (f) =>
                            f.id === (niActiveFileId || sourceFiles[0]?.id),
                        ) || sourceFiles[0];
                      if (!activeFile?.transcript) {
                        return (
                          <div className="mx-4 mt-3 flex h-48 items-center justify-center rounded-md border bg-zinc-50 text-sm text-zinc-400">
                            No transcript available for this file.
                          </div>
                        );
                      }
                      return (
                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 py-3">
                          <div className="flex shrink-0 items-center justify-between">
                            <p className="text-xs text-zinc-400">
                              Highlight text to select. Hold{" "}
                              <kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-600">
                                ⌘
                              </kbd>{" "}
                              for multiple selections.
                            </p>
                            <span
                              className={cn(
                                "text-xs tabular-nums",
                                niComposedQuoteText.length > MAX_QUOTE_LENGTH
                                  ? "font-medium text-red-500"
                                  : "text-zinc-400",
                              )}
                            >
                              {niComposedQuoteText.length}/{MAX_QUOTE_LENGTH}
                            </span>
                          </div>
                          <div
                            className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-white p-4 text-sm leading-relaxed select-text"
                            onMouseUp={(e) => {
                              const selection = window.getSelection();
                              if (
                                selection &&
                                selection.rangeCount > 0 &&
                                selection.toString().trim().length > 0
                              ) {
                                const text = selection.toString().trim();
                                const range = selection.getRangeAt(0);
                                const container = e.currentTarget;
                                const preRange = document.createRange();
                                preRange.selectNodeContents(container);
                                preRange.setEnd(
                                  range.startContainer,
                                  range.startOffset,
                                );
                                const startOffset = preRange.toString().length;
                                const rawText = selection.toString();
                                const leadingTrimmed =
                                  rawText.length - rawText.trimStart().length;
                                const adjustedStart =
                                  startOffset + leadingTrimmed;
                                const adjustedEnd = adjustedStart + text.length;
                                const isMultiSelect = e.metaKey || e.ctrlKey;
                                const existingSegments = isMultiSelect
                                  ? niQuoteSegments
                                  : [];
                                const overlappingIdx =
                                  existingSegments.findIndex(
                                    (s) =>
                                      adjustedStart < s.end &&
                                      adjustedEnd > s.start,
                                  );
                                if (overlappingIdx !== -1) {
                                  setNiQuoteSegments((prev) =>
                                    prev.filter((_, i) => i !== overlappingIdx),
                                  );
                                  selection.removeAllRanges();
                                  return;
                                }
                                const newSegment = {
                                  text,
                                  start: adjustedStart,
                                  end: adjustedEnd,
                                };
                                const newSegments = isMultiSelect
                                  ? [...niQuoteSegments, newSegment].sort(
                                      (a, b) => a.start - b.start,
                                    )
                                  : [newSegment];
                                const newComposed = newSegments
                                  .map((s) => s.text)
                                  .join(" ... ");
                                if (newComposed.length <= MAX_QUOTE_LENGTH) {
                                  setNiQuoteSegments(newSegments);
                                  setNiQuoteSourceFileId(activeFile.id);
                                } else {
                                  toast.error(
                                    `Selection would exceed the ${MAX_QUOTE_LENGTH} character limit`,
                                  );
                                }
                                selection.removeAllRanges();
                              } else if (!(e.metaKey || e.ctrlKey)) {
                                setNiQuoteSegments([]);
                              }
                            }}
                          >
                            <p className="whitespace-pre-wrap">
                              {(() => {
                                const transcript = activeFile.transcript || "";
                                if (niQuoteSegments.length === 0)
                                  return transcript;
                                const highlights = niQuoteSegments
                                  .map((seg) => ({
                                    start: seg.start,
                                    end: seg.end,
                                  }))
                                  .filter(
                                    (h) =>
                                      h.start >= 0 &&
                                      h.end <= transcript.length,
                                  )
                                  .sort((a, b) => a.start - b.start);
                                if (highlights.length === 0) return transcript;
                                const parts: React.ReactNode[] = [];
                                let cursor = 0;
                                highlights.forEach((h, i) => {
                                  if (h.start > cursor)
                                    parts.push(
                                      transcript.slice(cursor, h.start),
                                    );
                                  parts.push(
                                    <mark
                                      key={i}
                                      className="rounded-sm bg-blue-100 px-0.5 text-blue-900"
                                    >
                                      {transcript.slice(h.start, h.end)}
                                    </mark>,
                                  );
                                  cursor = h.end;
                                });
                                if (cursor < transcript.length)
                                  parts.push(transcript.slice(cursor));
                                return parts;
                              })()}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Current selection + participant */}
                    <div className="flex shrink-0 flex-col gap-2.5 border-t px-4 py-3">
                      {niQuoteSegments.length > 0 ? (
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Quote className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-medium text-blue-700">
                                {niQuoteSegments.length === 1
                                  ? "Selected quote"
                                  : `${niQuoteSegments.length} selections`}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="text-xs text-blue-500 hover:text-blue-700"
                              onClick={() => setNiQuoteSegments([])}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="max-h-24 overflow-y-auto">
                            <p
                              className="text-sm text-blue-900 italic"
                              style={{
                                fontFamily: "Georgia, 'Times New Roman', serif",
                              }}
                            >
                              &ldquo;
                              {niQuoteSegments.map((s) => s.text).join("... ")}
                              &rdquo;
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2">
                          <Quote className="h-3.5 w-3.5 text-zinc-300" />
                          <span className="text-xs text-zinc-400">
                            Highlight text above to select a quote
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="ni-quote-participant"
                          className="shrink-0 text-xs font-medium text-zinc-500"
                        >
                          Participant (optional)
                        </label>
                        <Input
                          id="ni-quote-participant"
                          value={niQuoteParticipant}
                          onChange={(e) =>
                            setNiQuoteParticipant(e.target.value)
                          }
                          placeholder="e.g., P1, Participant A"
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={
                          niQuoteSegments.length === 0 ||
                          niComposedQuoteText.length > MAX_QUOTE_LENGTH
                        }
                        onClick={handleAddNewInsightQuote}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add to quotes
                      </Button>
                    </div>

                    {/* Added quotes list */}
                    {newInsightQuotes.length > 0 && (
                      <div className="shrink-0 border-t px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-zinc-500">
                          {newInsightQuotes.length} quote
                          {newInsightQuotes.length !== 1 ? "s" : ""} added
                        </p>
                        <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                          {newInsightQuotes.map((q, idx) => (
                            <div
                              key={idx}
                              className="group/niq flex items-start gap-1.5 rounded-md border bg-zinc-50 px-2.5 py-1.5"
                            >
                              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
                              <p className="line-clamp-2 flex-1 text-xs text-zinc-600">
                                &ldquo;{q.text}&rdquo;
                              </p>
                              <button
                                type="button"
                                className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity group-hover/niq:opacity-100 hover:bg-zinc-200 hover:text-zinc-600"
                                onClick={() =>
                                  setNewInsightQuotes((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-4">
                    <p className="text-sm text-zinc-400">
                      No source files available. You can skip to the details
                      step.
                    </p>
                  </div>
                )}
              </div>

              <DrawerFooter className="shrink-0 border-t p-4">
                <div className="flex justify-between">
                  <DrawerClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DrawerClose>
                  <Button onClick={() => setNewInsightStep("fields")}>
                    Next
                  </Button>
                </div>
              </DrawerFooter>
            </>
          ) : (
            <>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={newInsightFields.title}
                    onChange={(e) =>
                      setNewInsightFields((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Give this insight a short, descriptive title"
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Insight Statement <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newInsightFields.insightStatement}
                    onChange={(e) =>
                      setNewInsightFields((prev) => ({
                        ...prev,
                        insightStatement: e.target.value,
                      }))
                    }
                    placeholder="A concise statement summarizing the insight"
                    className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Observation
                  </label>
                  <textarea
                    value={newInsightFields.observation}
                    onChange={(e) =>
                      setNewInsightFields((prev) => ({
                        ...prev,
                        observation: e.target.value,
                      }))
                    }
                    placeholder="What was observed?"
                    className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Motivation
                  </label>
                  <textarea
                    value={newInsightFields.motivation}
                    onChange={(e) =>
                      setNewInsightFields((prev) => ({
                        ...prev,
                        motivation: e.target.value,
                      }))
                    }
                    placeholder="Why does this matter?"
                    className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Implication
                  </label>
                  <textarea
                    value={newInsightFields.implication}
                    onChange={(e) =>
                      setNewInsightFields((prev) => ({
                        ...prev,
                        implication: e.target.value,
                      }))
                    }
                    placeholder="What are the implications or recommendations?"
                    className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    rows={3}
                  />
                </div>

                {/* Impact / Severity */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">
                    Impact
                  </label>
                  <div className="flex gap-1.5">
                    {IMPACT_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          newInsightFields.severity === level.value
                            ? cn(level.badgeColor, "border-transparent")
                            : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50",
                        )}
                        onClick={() =>
                          setNewInsightFields((prev) => ({
                            ...prev,
                            severity:
                              prev.severity === level.value
                                ? null
                                : level.value,
                          }))
                        }
                      >
                        <div
                          className={cn("h-2 w-2 rounded-full", level.dotColor)}
                        />
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary of quotes added */}
                {newInsightQuotes.length > 0 && (
                  <div className="rounded-md border bg-zinc-50 p-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      {newInsightQuotes.length} supporting quote
                      {newInsightQuotes.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
                      {newInsightQuotes.map((q, idx) => (
                        <p
                          key={idx}
                          className="line-clamp-1 text-xs text-zinc-500 italic"
                        >
                          &ldquo;{q.text}&rdquo;
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DrawerFooter className="shrink-0 border-t p-4">
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setNewInsightStep("quotes")}
                    disabled={savingNewInsight}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSaveNewInsight}
                    disabled={
                      !newInsightFields.title.trim() ||
                      !newInsightFields.insightStatement.trim() ||
                      savingNewInsight
                    }
                  >
                    {savingNewInsight ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add insight
                  </Button>
                </div>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
