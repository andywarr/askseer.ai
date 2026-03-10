"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
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
import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createQualAnalysisSchema,
  type QualAnalysisFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { type UploadPolicy } from "@/apps/nextjs-app/lib/db/study";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import { Loader2, ChevronDown, ChevronUp, Plus, X, Upload } from "lucide-react";
import { StickyFormFooter } from "@/apps/nextjs-app/components/study/sticky-form-footer";
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
import { QuestionsList } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/questions-list";
import { HypothesisList } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/hypothesis-list";
import { PersonaSelectionSection } from "@/apps/nextjs-app/app/(auth)/analysis/new/form-sections/persona-selection-section";
import type { PersonaStudy } from "@/apps/nextjs-app/components/persona/persona-select";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

// Accepted file types for context files (research plan, discussion guide docs)
const CONTEXT_FILE_ACCEPT =
  "text/plain,application/pdf,.txt,.md,.doc,.docx,.csv";

interface AnalysisFormProps {
  balanceCents: number;
  studyCostCents: number;
  uploadPolicy: UploadPolicy;
  canPurchaseCredits?: boolean;
}

export function AnalysisForm(props: AnalysisFormProps) {
  const { checkSession } = useSessionCheck();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaStudy[]>([]);

  // Interview files (audio, video, transcripts)
  const [interviewFiles, setInterviewFiles] = useState<File[]>([]);
  // Context files (research plan, discussion guide docs)
  const [contextFiles, setContextFiles] = useState<File[]>([]);

  const schema = useMemo(
    () => createQualAnalysisSchema(props.uploadPolicy),
    [props.uploadPolicy],
  );

  const form = useForm<QualAnalysisFormValues>({
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

  const isAnalysisDisabled =
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
        props.uploadPolicy.maxFiles,
      );
      setInterviewFiles(combined);
      form.setValue("files", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [interviewFiles, props.uploadPolicy.maxFiles, form],
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

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleInterviewDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (loading) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      const combined = [...interviewFiles, ...droppedFiles].slice(
        0,
        props.uploadPolicy.maxFiles,
      );
      setInterviewFiles(combined);
      form.setValue("files", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [interviewFiles, props.uploadPolicy.maxFiles, form, loading],
  );

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

  const handleSubmitButtonClick = async (data: QualAnalysisFormValues) => {
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

      const study = await initStudy(data.name || null, "qual_analysis");
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

      await finalizeAndQueueStudy("qual_analysis", study.id, {
        name: data.name || undefined,
        goal: data.goal || undefined,
        researchQuestions: data.researchQuestions || undefined,
        hypotheses: data.hypotheses || undefined,
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
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex flex-col gap-6 pb-24"
        >
          {/* Interview Data Upload (required) */}
          <FormField
            control={form.control}
            name="files"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem className="flex flex-1 flex-col">
                <FormLabel>Which interviews would you like to analyze?</FormLabel>
                <FormControl className="flex flex-1 flex-col">
                  <div className="flex flex-col min-h-[calc(100dvh-21rem)] min-h-[300px]">
                    <Input
                      {...fieldProps}
                      accept={props.uploadPolicy.allowedTypes}
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
                      onDragOver={handleDrag}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleInterviewDrop}
                      onClick={() => {
                        if (!loading)
                          document
                            .getElementById("interview-file-input")
                            ?.click();
                      }}
                      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"} flex-1 min-h-[120px]`}
                    >
                      <Upload className="text-muted-foreground h-6 w-6" />
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-sm font-medium">
                          Drop files or click to upload
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {props.uploadPolicy.acceptsAudioVideo
                            ? "Audio (.mp3, .wav, .m4a), video (.mp4, .webm, .mov), or text transcripts (.txt, .md, .csv, .pdf, .docx, .vtt, .srt)"
                            : "Text transcripts (.txt, .md, .csv, .pdf, .docx, .vtt, .srt)"}
                          {" "}&middot; Max {props.uploadPolicy.maxSizeMb}MB per file
                        </span>
                      </div>
                    </div>

                    {/* Interview file list */}
                    {interviewFiles.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
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

              <QuestionsList loading={loading} />
              <HypothesisList loading={loading} />

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

              <PersonaSelectionSection
                loading={loading}
                selectedPersonas={selectedPersonas}
                onChange={setSelectedPersonas}
              />

              <div className="flex flex-col gap-2">
                <FormLabel className="mb-2 block">Do you have any supporting documents?</FormLabel>
                <Input
                  accept={CONTEXT_FILE_ACCEPT}
                  className="hidden"
                  id="context-file-input"
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
                      document.getElementById("context-file-input")?.click();
                  }}
                  className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                >
                  <Upload className="text-muted-foreground h-6 w-6" />
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-sm font-medium">
                      Drop files or click to upload
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Research plans, discussion guides, or other documents &middot; Max{" "}
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
            <Button type="submit" className="w-32" disabled={isAnalysisDisabled}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze
            </Button>
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
