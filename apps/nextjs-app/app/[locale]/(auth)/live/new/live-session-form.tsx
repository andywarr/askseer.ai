"use client";

// Lib function imports
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
  createLiveSessionRecords,
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
  createLiveSessionSchema,
  type LiveSessionFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { type UploadPolicy } from "@/apps/nextjs-app/lib/db/study";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";

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
import { QuestionsList } from "@/apps/nextjs-app/app/[locale]/(auth)/analysis/new/form-sections/questions-list";
import { HypothesisList } from "@/apps/nextjs-app/app/[locale]/(auth)/analysis/new/form-sections/hypothesis-list";
import { PersonaSelectionSection } from "@/apps/nextjs-app/app/[locale]/(auth)/analysis/new/form-sections/persona-selection-section";
import type { PersonaStudy } from "@/apps/nextjs-app/components/persona/persona-select";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";

// Accepted file types for discussion guide files
const GUIDE_FILE_ACCEPT =
  "text/plain,application/pdf,.txt,.md,.doc,.docx,.csv,.pdf";

// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

interface LiveSessionFormProps {
  balanceCents: number;
  studyCostCents: number;
  uploadPolicy: UploadPolicy;
  canPurchaseCredits?: boolean;
  teamName?: string | null;
}

export function LiveSessionForm(props: LiveSessionFormProps) {
  const { checkSession } = useSessionCheck();
  const tc = useTranslations("StudyWizardForms.common");
  const tl = useTranslations("StudyWizardForms.live");
  const tv = useTranslations("StudyWizardForms.validation");
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaStudy[]>([]);

  // Discussion guide files (primary upload)
  const [guideFiles, setGuideFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const schema = useMemo(
    () => createLiveSessionSchema(props.uploadPolicy, tv),
    [props.uploadPolicy, tv],
  );

  const form = useForm<LiveSessionFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      goal: "",
      researchQuestions: [],
      hypotheses: [],
      context: "",
      participantCount: 1,
      guideFiles: [],
    },
  });

  const watchedParticipantCount = form.watch("participantCount") || 1;
  const totalCostCents = props.studyCostCents * watchedParticipantCount;
  const hasInsufficientFunds = props.balanceCents < totalCostCents;

  const isSubmitDisabled =
    loading ||
    hasInsufficientFunds ||
    guideFiles.length === 0;

  // Guide file handlers
  const addGuideFiles = useCallback(
    (newFiles: File[]) => {
      // Only one guide file allowed — replace any existing
      const combined = newFiles.slice(0, 1);
      setGuideFiles(combined);
      form.setValue("guideFiles", combined, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [guideFiles, form],
  );

  const handleGuideFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = e.target.files ? Array.from(e.target.files) : [];
      if (newFiles.length === 0) return;
      addGuideFiles(newFiles);
    },
    [addGuideFiles],
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

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;
      addGuideFiles(droppedFiles);
    },
    [addGuideFiles, loading],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (loading) return;

      // Check for pasted files first (e.g. screenshots)
      const pastedFiles = Array.from(e.clipboardData.files);
      if (pastedFiles.length > 0) {
        addGuideFiles(pastedFiles);
        return;
      }

      // Convert pasted text to a .txt file
      const text = e.clipboardData.getData("text/plain");
      if (text && text.trim().length > 0) {
        const blob = new Blob([text], { type: "text/plain" });
        const file = new File([blob], "discussion-guide.txt", {
          type: "text/plain",
        });
        addGuideFiles([file]);
        toast.success(tc("pastedTextSuccess"));
      }
    },
    [addGuideFiles, loading],
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

  const handleSubmitButtonClick = async (data: LiveSessionFormValues) => {
    let studyId: string | undefined;
    try {
      form.clearErrors("guideFiles");
      setConnectivityError(null);
      setLoading(true);

      if (isOffline()) {
        setConnectivityError(tc("offlineError"));
        toast.error(tc("offlineTitle"), {
          description: tc("offlineDesc"),
        });
        return;
      }

      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        return;
      }

      if (guideFiles.length === 0) {
        form.setError("guideFiles", {
          type: "manual",
          message: tv("filesMinGuide"),
        });
        return;
      }

      // 1. Create the study record
      const study = await initStudy(data.name || null, "live_session", null, locale);
      studyId = study.id;

      // 2. Upload discussion guide files
      const uploadedGuideFiles = await uploadFiles(guideFiles, study.id);

      // 3. Create live session records (LiveKit rooms)
      const participantCount = data.participantCount || 1;
      await createLiveSessionRecords(study.id, participantCount);

      // 4. Queue AI processing (infer goal, questions, generate cover image)
      // finalizeAndQueueStudy will redirect to /live/${studyId}
      await finalizeAndQueueStudy("live_session", study.id, {
        name: data.name || undefined,
        goal: data.goal || undefined,
        researchQuestions: data.researchQuestions || undefined,
        hypotheses: data.hypotheses || undefined,
        context: data.context || undefined,
        files: uploadedGuideFiles,
        participantCount,
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

      clientLogger.error("Error creating live session", {
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

      const toastTitle = isOffline()
        ? tc("offlineTitle")
        : tc("failedSubmitTitle");
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
          className="flex flex-col gap-6 pb-20"
        >
          {/* Discussion Guide Upload (required) */}
          <FormField
            control={form.control}
            name="guideFiles"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem className="flex flex-1 flex-col">
                <FormLabel>
                  {tl("guideLabel")}
                </FormLabel>
                <FormControl className="flex flex-1 flex-col">
                  <div className="flex flex-col min-h-[calc(100dvh-21rem)] min-h-[300px]">
                    <Input
                      {...fieldProps}
                      accept={GUIDE_FILE_ACCEPT}
                      className="hidden"
                      id="guide-file-input"
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
                      } ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"} flex-1 min-h-[120px]`}
                      onClick={() => {
                        if (!loading)
                          document.getElementById("guide-file-input")?.click();
                      }}
                    >
                      <Upload className="text-muted-foreground h-6 w-6" />
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="text-sm font-medium">
                          {tl("guideDropText")}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {tl("guideFormats")}
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
            {showOptionalFields ? tc("lessIsMore") : tc("knowSomething")}
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
                      {tc("nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tc("namePlaceholderLive")}
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
                    <FormLabel>{tc("learnLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tc("learnPlaceholder")}
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
                      {tc("contextLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={tc("contextPlaceholderTextarea")}
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
                    <FormLabel>{tl("sessionsLabel")}</FormLabel>
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
                      {tl("sessionsDesc")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <StickyFormFooter>
            <div className="flex items-center gap-4">
              <Button type="submit" className="w-48 shrink-0" disabled={isSubmitDisabled}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc("create")}
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
