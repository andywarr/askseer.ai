"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
  cleanupOrphanedStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";
import { toast } from "sonner";
import {
  isOffline,
  uploadFileWithRetry,
  uploadFilesWithConcurrencyLimit,
  getUploadErrorMessage,
} from "@/apps/nextjs-app/utils/upload";

// React imports
import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createAnalyzeSchema,
  type AnalyzeFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import { Loader2, ChevronDown, ChevronUp, Plus, X, Upload } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import {
  PersonaSelect,
  type PersonaStudy,
} from "@/apps/nextjs-app/components/persona/persona-select";
import { getPersonaImageUrl } from "@/apps/nextjs-app/lib/utils/get-persona-image-url";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

// Accepted file types for interview data
const INTERVIEW_FILE_ACCEPT =
  "audio/*,video/mp4,video/webm,video/quicktime,video/x-m4v,text/plain,text/csv,application/pdf,.txt,.md,.doc,.docx,.vtt,.srt";

// Accepted file types for context files (research plan, discussion guide docs)
const CONTEXT_FILE_ACCEPT =
  "text/plain,application/pdf,.txt,.md,.doc,.docx,.csv";

interface AnalysisFormProps {
  balanceCents: number;
  studyCostCents: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
}

export function AnalysisForm(props: AnalysisFormProps) {
  const { checkSession } = useSessionCheck();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [researchQuestions, setResearchQuestions] = useState<string[]>([]);
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newHypothesis, setNewHypothesis] = useState("");

  // Persona selection state
  const [privatePersonas, setPrivatePersonas] = useState<PersonaStudy[]>([]);
  const [teamPersonas, setTeamPersonas] = useState<PersonaStudy[]>([]);
  const [companyPersonas, setCompanyPersonas] = useState<PersonaStudy[]>([]);
  const [isDefaultTeam, setIsDefaultTeam] = useState(false);
  const [isPersonasLoading, setIsPersonasLoading] = useState(true);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaStudy[]>([]);
  const [personaSelectId, setPersonaSelectId] = useState<string | null>(null);
  const [personaInputValue, setPersonaInputValue] = useState("");
  const [personaImageUrls, setPersonaImageUrls] = useState<
    Record<string, string>
  >({});

  // Load personas on mount
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const result = await listMyPersonas();
        setPrivatePersonas(result.privatePersonas as unknown as PersonaStudy[]);
        setTeamPersonas(result.teamPersonas as unknown as PersonaStudy[]);
        setCompanyPersonas(result.companyPersonas as unknown as PersonaStudy[]);
        setIsDefaultTeam(result.isDefaultTeam || false);
      } catch (error) {
        clientLogger.error("Failed to load personas", { error });
      } finally {
        setIsPersonasLoading(false);
      }
    };
    loadPersonas();
  }, []);

  // Add a persona to the selected list
  const handleAddPersona = useCallback(
    (persona: PersonaStudy) => {
      if (selectedPersonas.some((p) => p.id === persona.id)) return;
      setSelectedPersonas((prev) => [...prev, persona]);
      // Load image for this persona
      const key = persona.persona?.photoFile?.key;
      if (key) {
        getPersonaImageUrl(key).then((url) => {
          if (url) {
            setPersonaImageUrls((prev) => ({ ...prev, [persona.id]: url }));
          }
        });
      }
      // Reset picker
      setPersonaSelectId(null);
      setPersonaInputValue("");
    },
    [selectedPersonas],
  );

  // Remove a persona from the selected list
  const handleRemovePersona = useCallback((studyId: string) => {
    setSelectedPersonas((prev) => prev.filter((p) => p.id !== studyId));
  }, []);

  // Interview files (audio, video, transcripts)
  const [interviewFiles, setInterviewFiles] = useState<File[]>([]);
  // Context files (research plan, discussion guide docs)
  const [contextFiles, setContextFiles] = useState<File[]>([]);

  const schema = useMemo(
    () => createAnalyzeSchema(props.maxFiles),
    [props.maxFiles],
  );

  const form = useForm<AnalyzeFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      goal: "",
      researchQuestions: [],
      hypotheses: [],
      discussionGuide: "",
      context: "",
      files: [],
      contextFiles: [],
    },
  });

  const isAnalyzeDisabled =
    loading ||
    props.balanceCents < props.studyCostCents ||
    interviewFiles.length === 0;

  // Interview file handlers
  const handleInterviewFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = e.target.files ? Array.from(e.target.files) : [];
      if (newFiles.length === 0) return;

      const combined = [...interviewFiles, ...newFiles].slice(
        0,
        props.maxFiles,
      );
      setInterviewFiles(combined);
      form.setValue("files", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [interviewFiles, props.maxFiles, form],
  );

  const handleRemoveInterviewFile = useCallback(
    (index: number) => {
      const updated = interviewFiles.filter((_, i) => i !== index);
      setInterviewFiles(updated);
      form.setValue("files", updated, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [interviewFiles, form],
  );

  // Context file handlers
  const handleContextFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = e.target.files ? Array.from(e.target.files) : [];
      if (newFiles.length === 0) return;

      const combined = [...contextFiles, ...newFiles].slice(0, 10);
      setContextFiles(combined);
      form.setValue("contextFiles", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [contextFiles, form],
  );

  const handleRemoveContextFile = useCallback(
    (index: number) => {
      const updated = contextFiles.filter((_, i) => i !== index);
      setContextFiles(updated);
      form.setValue("contextFiles", updated, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [contextFiles, form],
  );

  // Research question handlers
  const handleAddQuestion = useCallback(() => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    const updated = [...researchQuestions, trimmed];
    setResearchQuestions(updated);
    form.setValue("researchQuestions", updated);
    setNewQuestion("");
  }, [newQuestion, researchQuestions, form]);

  const handleRemoveQuestion = useCallback(
    (index: number) => {
      const updated = researchQuestions.filter((_, i) => i !== index);
      setResearchQuestions(updated);
      form.setValue("researchQuestions", updated);
    },
    [researchQuestions, form],
  );

  // Hypothesis handlers
  const handleAddHypothesis = useCallback(() => {
    const trimmed = newHypothesis.trim();
    if (!trimmed) return;
    const updated = [...hypotheses, trimmed];
    setHypotheses(updated);
    form.setValue("hypotheses", updated);
    setNewHypothesis("");
  }, [newHypothesis, hypotheses, form]);

  const handleRemoveHypothesis = useCallback(
    (index: number) => {
      const updated = hypotheses.filter((_, i) => i !== index);
      setHypotheses(updated);
      form.setValue("hypotheses", updated);
    },
    [hypotheses, form],
  );

  const uploadFiles = async (filesToUpload: File[], studyId: string) => {
    const fileMetadata = filesToUpload.map((file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    const presigned = await getStudyUploadUrls(studyId, fileMetadata);

    await uploadFilesWithConcurrencyLimit(
      presigned,
      async (urlData: PresignedUploadUrl, index: number) => {
        const file: File = filesToUpload[index];
        await uploadFileWithRetry(file, urlData.uploadURL, {
          maxRetries: 3,
          onRetry: (attempt, error) => {
            clientLogger.warn(`Retrying upload for ${file.name}`, {
              attempt,
              error: error.message,
            });
          },
        });
      },
    );
    return presigned.map((p: PresignedUploadUrl, i: number) => ({
      name: filesToUpload[i].name,
      key: p.key,
      size: filesToUpload[i].size,
      type: filesToUpload[i].type,
    }));
  };

  const handleSubmitButtonClick = async (data: AnalyzeFormValues) => {
    let studyId: string | undefined;
    try {
      form.clearErrors("files");
      setConnectivityError(null);
      setLoading(true);

      if (isOffline()) {
        setConnectivityError(
          "You appear to be offline. Please check your internet connection.",
        );
        toast.error("You're offline", {
          description: "Please check your internet connection and try again.",
        });
        return;
      }

      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        return;
      }

      if (interviewFiles.length === 0) {
        form.setError("files", {
          type: "manual",
          message:
            "At least one interview file must be uploaded (audio, video, or transcript).",
        });
        return;
      }

      const study = await initStudy(data.name || null, "analyze");
      studyId = study.id;

      // Upload interview files
      const uploadedInterviewFiles = await uploadFiles(
        interviewFiles,
        study.id,
      );

      // Upload context files if any
      let uploadedContextFiles: Array<{
        name: string;
        key: string;
        size: number;
        type: string;
      }> = [];
      if (contextFiles.length > 0) {
        uploadedContextFiles = await uploadFiles(contextFiles, study.id);
      }

      await finalizeAndQueueStudy("analyze", study.id, {
        name: data.name || undefined,
        goal: data.goal || undefined,
        researchQuestions:
          researchQuestions.length > 0 ? researchQuestions : undefined,
        hypotheses: hypotheses.length > 0 ? hypotheses : undefined,
        discussionGuide: data.discussionGuide || undefined,
        context: data.context || undefined,
        files: uploadedInterviewFiles,
        contextFiles:
          uploadedContextFiles.length > 0 ? uploadedContextFiles : undefined,
        personas:
          selectedPersonas.length > 0
            ? selectedPersonas.map((p) => ({
                studyId: p.id,
                name: p.persona?.name || p.name || undefined,
                description: p.persona?.description || undefined,
                data: p.persona?.data || undefined,
              }))
            : undefined,
      });
    } catch (error) {
      const isNextRedirect =
        (error as any)?.digest?.toString?.().startsWith?.("NEXT_REDIRECT") ||
        (error as any)?.message?.includes?.("NEXT_REDIRECT");
      if (isNextRedirect) {
        throw error;
      }

      if (studyId) {
        await cleanupOrphanedStudy(studyId);
      }

      clientLogger.error("Error submitting analysis", {
        error:
          error instanceof Error
            ? { message: error.message }
            : (error ?? "unknown"),
        isOffline: isOffline(),
      });

      const message = getUploadErrorMessage(error);

      const isConnectivityIssue =
        isOffline() ||
        message.toLowerCase().includes("offline") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("connection");

      if (isConnectivityIssue) {
        setConnectivityError(message);
      } else {
        form.setError("files", {
          type: "manual",
          message,
        });
      }

      const toastTitle = isOffline()
        ? "You're offline"
        : "Failed to submit study";
      toast.error(toastTitle, {
        description: message,
      });

      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="overflow-hidden">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6 overflow-hidden"
        >
          {/* Interview Data Upload (required) */}
          <FormField
            control={form.control}
            name="files"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>Which interviews would you like to analyze?</FormLabel>
                <FormControl>
                  <div>
                    <Input
                      {...fieldProps}
                      accept={INTERVIEW_FILE_ACCEPT}
                      className="hidden"
                      id="interview-file-input"
                      multiple={true}
                      onChange={(e) => {
                        onChange(
                          e.target.files ? Array.from(e.target.files) : [],
                        );
                        handleInterviewFileChange(e);
                      }}
                      type="file"
                      disabled={loading}
                    />
                    <div
                      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4 ${loading ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <Upload className="h-4 w-4" />
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() =>
                          document
                            .getElementById("interview-file-input")
                            ?.click()
                        }
                        disabled={loading}
                      >
                        Upload Interview Files
                      </Button>
                      <p className="text-muted-foreground text-sm">
                        Supported: audio (.mp3, .wav, .m4a), video (.mp4, .webm,
                        .mov), transcripts (.txt, .pdf, .doc, .vtt, .srt)
                      </p>
                    </div>

                    {/* Interview file list */}
                    {interviewFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {interviewFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="flex flex-col">
                              <span className="max-w-xs truncate text-sm font-medium">
                                {file.name}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => handleRemoveInterviewFile(index)}
                              disabled={loading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Optional Fields Toggle */}
          <Button
            type="button"
            variant="ghost"
            className="flex w-fit items-center gap-2 text-sm"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
          >
            {showOptionalFields ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showOptionalFields ? "Less is more" : "Know something we don't?"}
          </Button>

          {showOptionalFields && (
            <div className="flex flex-col gap-6 rounded-lg border p-4">
              {/* Study Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What would you like to call this study?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter a name for the study e.g., Q1 User Onboarding Interviews"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Research Goal */}
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What are you trying to learn?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter the research goal e.g., Understand why users abandon the onboarding flow"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Research Questions */}
              <div>
                <FormLabel>What specific questions are you investigating?</FormLabel>
                {researchQuestions.length > 0 && (
                  <div className="mb-2 mt-2 space-y-2">
                    {researchQuestions.map((q, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm">{q}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleRemoveQuestion(index)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="e.g., What are the primary friction points in onboarding?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddQuestion();
                      }
                    }}
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleAddQuestion}
                    disabled={loading || !newQuestion.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Hypotheses */}
              <div>
                <FormLabel>What do you think you'll find?</FormLabel>
                {hypotheses.length > 0 && (
                  <div className="mb-2 mt-2 space-y-2">
                    {hypotheses.map((h, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm">{h}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleRemoveHypothesis(index)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="e.g., Users skip onboarding because it feels generic"
                    value={newHypothesis}
                    onChange={(e) => setNewHypothesis(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddHypothesis();
                      }
                    }}
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleAddHypothesis}
                    disabled={loading || !newHypothesis.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Discussion Guide */}
              <FormField
                control={form.control}
                name="discussionGuide"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Do you have a discussion guide or interview script?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste your discussion guide here... Alternatively, you can upload it below."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Additional Context */}
              <FormField
                control={form.control}
                name="context"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What additional information would be helpful?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., This research is for a B2B SaaS product targeting mid-market companies..."
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Linked Personas */}
              <div>
                <FormLabel>Who is the target user?</FormLabel>

                {/* Selected persona cards */}
                {selectedPersonas.length > 0 && (
                  <div className="mb-3 space-y-3">
                    {selectedPersonas.map((p) => {
                      const name =
                        p.persona?.name || p.name || "Unnamed persona";
                      const desc = p.persona?.description || "";
                      const img = personaImageUrls[p.id] || "";

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-md border px-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              {img ? (
                                <AvatarImage src={img} alt={name} />
                              ) : null}
                              <AvatarFallback>
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {name}
                              </div>
                              {desc ? (
                                <div className="text-muted-foreground truncate text-xs">
                                  {desc}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => handleRemovePersona(p.id)}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Persona picker */}
                {isPersonasLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <PersonaSelect
                    privatePersonas={privatePersonas}
                    personas={teamPersonas}
                    companyPersonas={companyPersonas}
                    selectedId={personaSelectId}
                    inputValue={personaInputValue}
                    onChange={({ selectedId, inputValue, persona }) => {
                      setPersonaSelectId(selectedId);
                      setPersonaInputValue(inputValue);
                      if (persona && selectedId) {
                        handleAddPersona(persona);
                      }
                    }}
                    getImageUrl={getPersonaImageUrl}
                    placeholder="Search for a persona to add..."
                    isDefaultTeam={isDefaultTeam}
                    disabled={loading}
                  />
                )}
              </div>

              {/* Context File Uploads */}
              <div>
                <FormLabel>Do you have any supporting documents?</FormLabel>
                <Input
                  accept={CONTEXT_FILE_ACCEPT}
                  className="hidden"
                  id="context-file-input"
                  multiple={true}
                  onChange={handleContextFileChange}
                  type="file"
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    document.getElementById("context-file-input")?.click()
                  }
                  disabled={loading}
                  className="mb-2"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>

                {contextFiles.length > 0 && (
                  <div className="space-y-2">
                    {contextFiles.map((file, index) => (
                      <div
                        key={`ctx-${file.name}-${index}`}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="max-w-xs truncate text-sm font-medium">
                            {file.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleRemoveContextFile(index)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button type="submit" className="w-32" disabled={isAnalyzeDisabled}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze
          </Button>
          {connectivityError && (
            <p className="-mt-4 text-sm text-red-500 dark:text-red-900">
              {connectivityError}
            </p>
          )}
        </form>
      </Form>
    </div>
  );
}
