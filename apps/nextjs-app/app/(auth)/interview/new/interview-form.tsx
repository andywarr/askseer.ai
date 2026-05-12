"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
  createInterviewRecords,
  cleanupOrphanedStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { toast } from "sonner";
import {
  isOffline,
  uploadFileWithRetry,
  uploadFilesWithConcurrencyLimit,
  getUploadErrorMessage,
} from "@/apps/nextjs-app/utils/upload";

// React imports
import { useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createInterviewSchema,
  type InterviewFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { type UploadPolicy } from "@/apps/nextjs-app/lib/db/study";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import { Loader2, ChevronDown, ChevronUp, X, Upload } from "lucide-react";
import { StickyFormFooter } from "@/apps/nextjs-app/components/study/sticky-form-footer";
import { InsufficientFundsMessage } from "@/apps/nextjs-app/components/funds/insufficient-funds-message";
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
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { QuestionsList } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/questions-list";
import { HypothesisList } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/hypothesis-list";
import { PersonaSelectionSection } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/persona-selection-section";
import type { PersonaStudy } from "@/apps/nextjs-app/components/persona/persona-select";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

const GUIDE_FILE_ACCEPT =
  "text/plain,application/pdf,.txt,.md,.doc,.docx,.csv,.pdf";

// Accepted file types for context files (supporting docs)
const CONTEXT_FILE_ACCEPT =
  "text/plain,application/pdf,.txt,.md,.doc,.docx,.csv";

// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

interface InterviewFormProps {
  balanceCents: number;
  studyCostCents: number;
  uploadPolicy: UploadPolicy;
  canPurchaseCredits?: boolean;
  teamName?: string | null;
}

export function InterviewForm(props: InterviewFormProps) {
  const { checkSession } = useSessionCheck();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaStudy[]>([]);

  // Guide files (the primary discussion guide)
  const [guideFiles, setGuideFiles] = useState<File[]>([]);
  // Context files (supporting documents)
  const [contextFiles, setContextFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const schema = useMemo(() => createInterviewSchema(), []);

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      goal: "",
      researchQuestions: [],
      hypotheses: [],
      context: "",
      guideFiles: [],
      contextFiles: [],
      participantCount: 1,
    },
  });

  const watchedParticipantCount = form.watch("participantCount") || 1;
  const totalCostCents = props.studyCostCents * watchedParticipantCount;
  const hasInsufficientFunds = props.balanceCents < totalCostCents;

  const isSubmitDisabled =
    loading || hasInsufficientFunds || guideFiles.length === 0;

  // Guide file handlers
  const handleGuideFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = e.target.files ? Array.from(e.target.files) : [];
      if (newFiles.length === 0) return;
      const combined = newFiles.slice(0, 1);
      setGuideFiles(combined);
      form.setValue("guideFiles", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form],
  );

  const handleRemoveGuideFile = useCallback(
    (index: number) => {
      const updated = guideFiles.filter((_, i) => i !== index);
      setGuideFiles(updated);
      form.setValue("guideFiles", updated, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [guideFiles, form],
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

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleGuideDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (loading) return;
      const droppedFiles = Array.from(e.dataTransfer.files).slice(0, 1);
      if (droppedFiles.length === 0) return;
      setGuideFiles(droppedFiles);
      form.setValue("guideFiles", droppedFiles, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form, loading],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (loading) return;
      const pastedFiles = Array.from(e.clipboardData.files);
      if (pastedFiles.length > 0) {
        const sliced = pastedFiles.slice(0, 1);
        setGuideFiles(sliced);
        form.setValue("guideFiles", sliced, {
          shouldValidate: true,
          shouldDirty: true,
        });
        return;
      }
      const text = e.clipboardData.getData("text/plain");
      if (text && text.trim().length > 0) {
        const blob = new Blob([text], { type: "text/plain" });
        const file = new File([blob], "discussion-guide.txt", {
          type: "text/plain",
        });
        setGuideFiles([file]);
        form.setValue("guideFiles", [file], {
          shouldValidate: true,
          shouldDirty: true,
        });
        toast.success("Pasted text added as discussion guide");
      }
    },
    [form, loading],
  );

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleContextDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (loading) return;
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;
      const combined = [...contextFiles, ...droppedFiles].slice(0, 10);
      setContextFiles(combined);
      form.setValue("contextFiles", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [contextFiles, form, loading],
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmitButtonClick = async (data: InterviewFormValues) => {
    let studyId: string | undefined;
    try {
      form.clearErrors("guideFiles");
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
      if (!isSessionValid) return;

      if (guideFiles.length === 0) {
        form.setError("guideFiles", {
          type: "manual",
          message: "A discussion guide file must be uploaded.",
        });
        return;
      }

      // 1. Create the study record
      const study = await initStudy(data.name || null, "interview");
      studyId = study.id;

      // 2. Upload discussion guide files
      const uploadedGuideFiles = await uploadFiles(guideFiles, study.id);

      // 3. Upload context files if any
      let uploadedContextFiles: Array<{
        name: string;
        key: string;
        size: number;
        type: string;
      }> = [];
      if (contextFiles.length > 0) {
        uploadedContextFiles = await uploadFiles(contextFiles, study.id);
      }

      // 4. Create Interview record + N sessions
      const participantCount = data.participantCount || 1;
      const endDate = data.endDate ? new Date(data.endDate) : undefined;
      const startDate = data.startDate ? new Date(data.startDate) : undefined;
      await createInterviewRecords(
        study.id,
        participantCount,
        endDate,
        startDate,
      );

      // 5. Queue AI processing (parse guide → questions + system prompt + cover image)
      await finalizeAndQueueStudy("interview", study.id, {
        mode: "guide" as const,
        name: data.name || undefined,
        goal: data.goal || undefined,
        researchQuestions: data.researchQuestions || undefined,
        hypotheses: data.hypotheses || undefined,
        context: data.context || undefined,
        files: uploadedGuideFiles,
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
      if (isNextRedirect) throw error;

      if (studyId) {
        await cleanupOrphanedStudy(studyId);
      }

      clientLogger.error("Error creating interview study", {
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
        form.setError("guideFiles", {
          type: "manual",
          message,
        });
      }

      toast.error(
        isOffline() ? "You're offline" : "Failed to create interview",
        { description: message },
      );

      setLoading(false);
    }
  };

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6 pb-20"
        >
          {/* Discussion Guide Upload (required) */}
          <FormField
            control={form.control}
            name="guideFiles"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem className="flex flex-1 flex-col">
                <FormLabel>
                  What discussion guide will you be using for your interviews?
                </FormLabel>
                <FormControl className="flex flex-1 flex-col">
                  <div className="flex min-h-[300px] min-h-[calc(100dvh-21rem)] flex-col">
                    <Input
                      {...fieldProps}
                      accept={GUIDE_FILE_ACCEPT}
                      className="hidden"
                      id="interview-guide-file-input"
                      multiple={false}
                      onChange={(e) => {
                        onChange(
                          e.target.files ? Array.from(e.target.files) : [],
                        );
                        handleGuideFileChange(e);
                      }}
                      type="file"
                      disabled={loading}
                    />
                    <div
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleGuideDrop}
                      onPaste={handlePaste}
                      tabIndex={0}
                      className={`flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors focus:outline-none ${
                        isDragOver
                          ? "border-primary bg-primary/5"
                          : "border-blue-gray-300"
                      } ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"} min-h-[120px] flex-1`}
                      onClick={() => {
                        if (!loading)
                          document
                            .getElementById("interview-guide-file-input")
                            ?.click();
                      }}
                    >
                      <Upload className="text-muted-foreground h-6 w-6" />
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-sm font-medium">
                          Drop a file, paste text, or click to upload
                        </span>
                        <span className="text-muted-foreground text-xs">
                          PDF, Word, or text files (.pdf, .docx, .txt, .md,
                          .csv) &middot; Max 1MB
                        </span>
                      </div>
                    </div>

                    {/* Guide file list */}
                    {guideFiles.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {guideFiles.map((file, index) => (
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
                              onClick={() => handleRemoveGuideFile(index)}
                              disabled={loading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <FormMessage className="mt-2" />
                  </div>
                </FormControl>
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
                    <FormLabel>
                      What would you like to call this study?
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter a name for the study e.g., Q1 Pricing Research Interviews"
                        {...field}
                        disabled={loading}
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
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <QuestionsList loading={loading} />
              <HypothesisList loading={loading} />

              {/* Additional Context */}
              <FormField
                control={form.control}
                name="context"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      What additional information would be helpful?
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., This research is for a B2B SaaS product targeting mid-market companies..."
                        className="min-h-20"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <PersonaSelectionSection
                loading={loading}
                selectedPersonas={selectedPersonas}
                onChange={setSelectedPersonas}
              />

              {/* Number of Sessions */}
              <FormField
                control={form.control}
                name="participantCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Sessions / Participants</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        placeholder="1"
                        className="text-center"
                        style={{
                          width: `${Math.max(String(field.value ?? "").length + 5, 8)}ch`,
                        }}
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Each session generates unique Participant and Observer
                      links. You can add more later.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date & End Date */}
              <div className="flex flex-wrap gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Study start date{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="w-fit"
                          {...field}
                          disabled={loading}
                        />
                      </FormControl>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Participants cannot start before this date.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* End Date */}
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Study end date{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="w-fit"
                          {...field}
                          disabled={loading}
                        />
                      </FormControl>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Paused sessions will be marked as incomplete after this
                        date.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Supporting Documents */}
              <div className="flex flex-col gap-2">
                <FormLabel className="mb-2 block">
                  Do you have any supporting documents?
                </FormLabel>
                <Input
                  accept={CONTEXT_FILE_ACCEPT}
                  className="hidden"
                  id="interview-context-file-input"
                  multiple={true}
                  onChange={handleContextFileChange}
                  type="file"
                  disabled={loading}
                />
                <div
                  onDragOver={handleDrag}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleContextDrop}
                  onClick={() => {
                    if (!loading)
                      document
                        .getElementById("interview-context-file-input")
                        ?.click();
                  }}
                  className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                >
                  <Upload className="text-muted-foreground h-6 w-6" />
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-sm font-medium">
                      Drop files or click to upload
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Research plans, personas, or other documents &middot; Max{" "}
                      {props.uploadPolicy.maxSizeMb}MB per file
                    </span>
                  </div>
                </div>

                {contextFiles.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
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

          <StickyFormFooter>
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                className="w-48 shrink-0"
                disabled={isSubmitDisabled}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
              {hasInsufficientFunds && (
                <InsufficientFundsMessage
                  balanceCents={props.balanceCents}
                  costCents={totalCostCents}
                  canPurchaseCredits={props.canPurchaseCredits}
                  teamName={props.teamName}
                  costLabel={`${watchedParticipantCount} session${watchedParticipantCount > 1 ? "s" : ""}`}
                />
              )}
            </div>
            {connectivityError && (
              <p className="mt-2 text-sm text-red-500 dark:text-red-900">
                {connectivityError}
              </p>
            )}
          </StickyFormFooter>
        </form>
      </Form>
    </div>
  );
}
