"use client";

// Lib function imports
import {
  initStudy,
  finalizeAndQueueStudy,
  cleanupOrphanedStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import {
  isOffline,
  getUploadErrorMessage,
} from "@/apps/nextjs-app/utils/upload";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";
import { getPersonaImageUrl } from "@/apps/nextjs-app/lib/utils/get-persona-image-url";

// React imports
import { useState, useEffect, useMemo, useCallback } from "react";

// Form imports
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createStudyPlanSchema,
  type StudyPlanFormValues,
} from "@/apps/nextjs-app/lib/db/schema";

// Component imports
import {
  PersonaSelect,
  type PersonaStudy,
} from "@/apps/nextjs-app/components/persona/persona-select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import { DraggableListItem } from "@/apps/nextjs-app/app/(auth)/plan/new/draggable-list-item";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Loader2, Plus } from "lucide-react";

export function StudyPlanForm() {
  const { checkSession } = useSessionCheck();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [questionDraft, setQuestionDraft] = useState("");
  const [hypothesisDraft, setHypothesisDraft] = useState("");

  // Persona state
  const [isPersonasLoading, setIsPersonasLoading] = useState(true);
  const [privatePersonas, setPrivatePersonas] = useState<PersonaStudy[]>([]);
  const [personas, setPersonas] = useState<PersonaStudy[]>([]);
  const [companyPersonas, setCompanyPersonas] = useState<PersonaStudy[]>([]);
  const [isDefaultTeam, setIsDefaultTeam] = useState(false);
  const [personaInputValue, setPersonaInputValue] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );
  // Track persona IDs alongside display names for FK relationships
  const [participantPersonaIds, setParticipantPersonaIds] = useState<
    Map<string, string>
  >(new Map());
  const [participantPhotos, setParticipantPhotos] = useState<
    Record<string, string>
  >({});

  const schema = useMemo(() => createStudyPlanSchema(), []);

  const form = useForm<StudyPlanFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      goal: "",
      researchQuestions: [],
      hypotheses: [],
      targetUsers: [],
      context: "",
    },
  });

  // Load personas on mount
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const data = await listMyPersonas();
        setPrivatePersonas(
          Array.isArray(data?.privatePersonas)
            ? (data.privatePersonas as unknown as PersonaStudy[])
            : [],
        );
        setPersonas(
          Array.isArray(data?.teamPersonas)
            ? (data.teamPersonas as unknown as PersonaStudy[])
            : [],
        );
        setCompanyPersonas(
          Array.isArray(data?.companyPersonas)
            ? (data.companyPersonas as unknown as PersonaStudy[])
            : [],
        );
        setIsDefaultTeam(data?.isDefaultTeam || false);
      } catch (error) {
        clientLogger.error("Failed to load personas", { error });
      } finally {
        setIsPersonasLoading(false);
      }
    };
    loadPersonas();
  }, []);

  const handleSubmitButtonClick = async (data: StudyPlanFormValues) => {
    let studyId: string | undefined;
    try {
      setConnectivityError(null);
      setLoading(true);

      // Check if user is offline before proceeding
      if (isOffline()) {
        setConnectivityError(
          "You appear to be offline. Please check your internet connection.",
        );
        toast.error("You're offline", {
          description: "Please check your internet connection and try again.",
        });
        return;
      }

      // Check session is still valid before proceeding
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        return;
      }

      // Validate
      const validation = schema.safeParse(data);
      if (!validation.success) {
        const firstIssue = validation.error?.issues?.[0];
        const fieldName = firstIssue?.path?.[0];
        const message = firstIssue?.message || "Invalid form data.";
        if (
          typeof fieldName === "string" &&
          [
            "name",
            "goal",
            "researchQuestions",
            "hypotheses",
            "targetUsers",
            "context",
          ].includes(fieldName)
        ) {
          form.setError(fieldName as keyof StudyPlanFormValues, {
            type: "manual",
            message,
          });
        } else {
          form.setError("name", { type: "manual", message });
        }
        return;
      }

      const study = await initStudy(data.name, "plan");
      studyId = study.id;

      // Collect persona IDs from participants that are linked to personas
      const personaIds = (data.targetUsers ?? [])
        .map((name) => participantPersonaIds.get(name))
        .filter((id): id is string => !!id);

      await finalizeAndQueueStudy("plan", study.id, {
        name: data.name,
        goal: data.goal,
        researchQuestions: data.researchQuestions,
        hypotheses: data.hypotheses,
        personaIds: personaIds.length > 0 ? personaIds : undefined,
        context: data.context,
      });
    } catch (error) {
      // Allow framework redirect errors to propagate so navigation proceeds
      const isNextRedirect =
        (error as Record<string, unknown>)?.digest
          ?.toString?.()
          .startsWith?.("NEXT_REDIRECT") ||
        (error as Error)?.message?.includes?.("NEXT_REDIRECT");
      if (isNextRedirect) {
        throw error;
      }

      // Clean up orphaned study if it was created but not finalized
      if (studyId) {
        await cleanupOrphanedStudy(studyId);
      }

      clientLogger.error("Error submitting study plan", {
        error:
          error instanceof Error
            ? { message: error.message }
            : (error ?? "unknown"),
        isOffline: isOffline(),
      });

      // Get user-friendly error message
      const message = getUploadErrorMessage(error);

      // Check if this is a connectivity-related error
      const isConnectivityIssue =
        isOffline() ||
        message.toLowerCase().includes("offline") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("connection");

      if (isConnectivityIssue) {
        setConnectivityError(message);
      } else {
        form.setError("name", {
          type: "manual",
          message,
        });
      }

      // Show toast notification with appropriate title
      const toastTitle = isOffline()
        ? "You're offline"
        : "Failed to submit study plan";
      toast.error(toastTitle, {
        description: message,
      });

      setLoading(false);
    }
  };

  /** Reorder helper – mutate-in-place style used by react-dnd */
  const moveItems = useCallback(
    (
      arr: string[],
      dragIndex: number,
      hoverIndex: number,
    ): string[] => {
      const result = [...arr];
      const [removed] = result.splice(dragIndex, 1);
      result.splice(hoverIndex, 0, removed);
      return result;
    },
    [],
  );

  return (
    <DndProviderComponent>
    <div className="overflow-hidden">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6 overflow-hidden"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What would you like to call this study?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter a name for the study e.g., Onboarding Interview Analysis"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="goal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What are you trying to learn or understand?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your research goal e.g., Understand how users perceive the onboarding experience"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="researchQuestions"
            render={({ field }) => {
              const questions = field.value ?? [];
              const addQuestion = () => {
                const val = questionDraft.trim();
                if (!val) return;
                field.onChange([...questions, val]);
                setQuestionDraft("");
              };
              return (
                <FormItem>
                  <FormLabel>
                    What specific questions do you want to answer?
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="e.g., What are the main pain points during checkout?"
                        value={questionDraft}
                        onChange={(e) => setQuestionDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addQuestion();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={addQuestion}
                        disabled={!questionDraft.trim()}
                        className="h-10 w-10 flex-shrink-0"
                        aria-label="Add question"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  {questions.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {questions.map((q, idx) => (
                        <DraggableListItem
                          key={`rq-${q}-${idx}`}
                          itemType="research-question"
                          index={idx}
                          label={`RQ${idx + 1}`}
                          onMove={(dragIdx, hoverIdx) =>
                            field.onChange(
                              moveItems(questions, dragIdx, hoverIdx),
                            )
                          }
                          onRemove={(i) =>
                            field.onChange(
                              questions.filter((_, j) => j !== i),
                            )
                          }
                        >
                          {q}
                        </DraggableListItem>
                      ))}
                    </ul>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="hypotheses"
            render={({ field }) => {
              const hypotheses = field.value ?? [];
              const addHypothesis = () => {
                const val = hypothesisDraft.trim();
                if (!val) return;
                field.onChange([...hypotheses, val]);
                setHypothesisDraft("");
              };
              return (
                <FormItem>
                  <FormLabel>
                    What do you expect to find?
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="e.g., Users prefer visual guidance over text instructions"
                        value={hypothesisDraft}
                        onChange={(e) => setHypothesisDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addHypothesis();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={addHypothesis}
                        disabled={!hypothesisDraft.trim()}
                        className="h-10 w-10 flex-shrink-0"
                        aria-label="Add hypothesis"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  {hypotheses.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {hypotheses.map((h, idx) => (
                        <DraggableListItem
                          key={`h-${h}-${idx}`}
                          itemType="hypothesis"
                          index={idx}
                          label={`H${idx + 1}`}
                          onMove={(dragIdx, hoverIdx) =>
                            field.onChange(
                              moveItems(hypotheses, dragIdx, hoverIdx),
                            )
                          }
                          onRemove={(i) =>
                            field.onChange(
                              hypotheses.filter((_, j) => j !== i),
                            )
                          }
                        >
                          {h}
                        </DraggableListItem>
                      ))}
                    </ul>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="targetUsers"
            render={({ field }) => {
              const participants = field.value ?? [];
              const addParticipant = (label: string, personaId?: string) => {
                const val = label.trim();
                if (!val || participants.includes(val)) return;
                field.onChange([...participants, val]);
                // Track persona ID if this participant came from a persona
                if (personaId) {
                  setParticipantPersonaIds((prev) => {
                    const next = new Map(prev);
                    next.set(val, personaId);
                    return next;
                  });
                }
              };
              return (
                <FormItem>
                  <FormLabel>Who are the participants in this study?</FormLabel>
                  <FormControl>
                    {isPersonasLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <PersonaSelect
                        privatePersonas={privatePersonas}
                        personas={personas}
                        companyPersonas={companyPersonas}
                        selectedId={selectedPersonaId}
                        inputValue={personaInputValue}
                        onChange={({ selectedId, inputValue, persona }) => {
                          if (selectedId && persona) {
                            const name =
                              persona.persona?.name ||
                              persona.name ||
                              "Untitled persona";
                            addParticipant(name, selectedId);
                            // Resolve and store avatar photo
                            const photoKey =
                              persona.persona?.photoFile?.key;
                            if (photoKey) {
                              getPersonaImageUrl(photoKey)
                                .then((url) =>
                                  setParticipantPhotos((prev) => ({
                                    ...prev,
                                    [name]: String(url),
                                  })),
                                )
                                .catch(() => {});
                            }
                            setSelectedPersonaId(null);
                            setPersonaInputValue("");
                          } else {
                            setSelectedPersonaId(selectedId);
                            setPersonaInputValue(inputValue);
                          }
                        }}
                        getImageUrl={getPersonaImageUrl}
                        placeholder="Select a persona or type a description"
                        isDefaultTeam={isDefaultTeam}
                      />
                    )}
                  </FormControl>
                  {personaInputValue.trim() && !selectedPersonaId && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          addParticipant(personaInputValue);
                          setPersonaInputValue("");
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add &ldquo;{personaInputValue.trim()}&rdquo;
                      </Button>
                    </div>
                  )}
                  {participants.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {participants.map((p, idx) => (
                        <DraggableListItem
                          key={`p-${p}-${idx}`}
                          itemType="participant"
                          index={idx}
                          onMove={(dragIdx, hoverIdx) =>
                            field.onChange(
                              moveItems(participants, dragIdx, hoverIdx),
                            )
                          }
                          onRemove={(i) => {
                            const removed = participants[i];
                            field.onChange(
                              participants.filter((_, j) => j !== i),
                            );
                            // Clean up persona ID mapping
                            if (removed) {
                              setParticipantPersonaIds((prev) => {
                                const next = new Map(prev);
                                next.delete(removed);
                                return next;
                              });
                            }
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {participantPhotos[p] !== undefined && (
                              <Avatar className="h-5 w-5">
                                <AvatarImage
                                  src={participantPhotos[p]}
                                  alt={p}
                                />
                                <AvatarFallback className="text-[10px]">
                                  {p.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {p}
                          </span>
                        </DraggableListItem>
                      ))}
                    </ul>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="context"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  What additional information would be helpful?
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter additional context e.g., This study is a follow up to a previous usability test"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-32"
            disabled={
              loading ||
              !form.formState.isValid
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
          {connectivityError && (
            <p className="-mt-4 text-sm text-red-500 dark:text-red-900">
              {connectivityError}
            </p>
          )}
        </form>
      </Form>
    </div>
    </DndProviderComponent>
  );
}
