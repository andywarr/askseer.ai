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
import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createCognitiveWalkthroughSchema,
  type CognitiveWalkthroughFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import { LongFlowWarning } from "@/apps/nextjs-app/components/study/long-flow-warning";
import { FigmaFramesOnlyWarning } from "@/apps/nextjs-app/components/study/figma-frames-only-warning";
import { VideoExtractionProgress } from "@/apps/nextjs-app/components/study/video-extraction-progress";
import { FigmaImportSection } from "@/apps/nextjs-app/components/study/figma-import-section";
import { FileUploadZone } from "@/apps/nextjs-app/components/study/file-upload-zone";
import { FileCardList } from "@/apps/nextjs-app/components/study/file-card-list";
import { StickyFormFooter } from "@/apps/nextjs-app/components/study/sticky-form-footer";
import { InsufficientFundsMessage } from "@/apps/nextjs-app/components/funds/insufficient-funds-message";

// UI Component imports
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

// Other imports
import {
  PersonaSelect,
  type PersonaStudy,
} from "@/apps/nextjs-app/components/persona/persona-select";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";
import { getPersonaImageUrl } from "@/apps/nextjs-app/lib/utils/get-persona-image-url";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import type { FigmaFileMetadata } from "@/apps/nextjs-app/types/types";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import { useStudyFileManagement } from "@/apps/nextjs-app/hooks/use-study-file-management";
import type { PluginSessionData } from "@/apps/nextjs-app/lib/auth/plugin-session";

// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

export interface BenchmarkSourceStudy {
  id: string;
  mode?: "flow" | "persona";
  goal?: string | null;
  user?: string | null;
  context?: string | null;
  personaStudyId?: string | null;
  personaName?: string | null;
  sourceFiles?: Array<{
    name: string;
    key: string;
    size: number;
    type: string;
  }> | null;
  benchmarkContext?: {
    sourceStudyId?: string;
    results?: Array<{
      heuristic: string;
      violated: boolean;
      reason: string;
      severity?: number | null;
      recommendations?: string[];
    }>;
    issues?: Array<{
      issue?: string;
      issueType?: string;
      severity?: number | null;
      recommendations?: string[];
    }>;
  };
}

export function CognitiveWalkthroughForm(props: {
  balanceCents: number;
  studyCostCents: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
  teamName?: string | null;
  pluginSession?: PluginSessionData | null;
  benchmarkSourceStudy?: BenchmarkSourceStudy | null;
}) {
  const { checkSession } = useSessionCheck();

  const isBenchmark = !!props.benchmarkSourceStudy;
  const benchmarkMode = props.benchmarkSourceStudy?.mode;
  const lockPersona = isBenchmark && benchmarkMode !== "persona";
  const lockFlow = isBenchmark && benchmarkMode !== "flow";
  const lockMeta = isBenchmark;
  const isUploadDisabled = lockFlow;

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [showOptionalFields, setShowOptionalFields] = useState(isBenchmark);

  const schema = useMemo(
    () =>
      createCognitiveWalkthroughSchema(
        props.maxFiles,
        benchmarkMode === "persona",
      ),
    [props.maxFiles, benchmarkMode],
  );

  const form = useForm<CognitiveWalkthroughFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: props.pluginSession?.fileName || "",
      goal: props.benchmarkSourceStudy?.goal || "",
      user: props.benchmarkSourceStudy?.user || "",
      files: [],
      context: props.benchmarkSourceStudy?.context || "",
    },
  });

  // File management (files, figma, drag-drop, video extraction, plugin frames)
  const {
    files,
    figmaMetadata,
    sortDirection,
    isCardListLoading,
    videoExtractionProgress,
    figmaConnected,
    figmaUrl,
    figmaLoading,
    figmaError,
    showFigmaFrameWarning,
    setFigmaConnected,
    setFigmaUrl,
    isInteractionDisabled,
    fileInputRef,
    handleUploadButtonClick,
    handleDrag,
    handleDrop,
    handleFileInputChange,
    handleSortToggle,
    handleFigmaImport,
    moveCard,
    handleDeleteButtonClick,
  } = useStudyFileManagement({
    maxFiles: props.maxFiles,
    pluginSession: props.pluginSession,
    form,
  });

  // Personas state
  const [privatePersonas, setPrivatePersonas] = useState<PersonaStudy[]>([]);
  const [personas, setPersonas] = useState<PersonaStudy[]>([]);
  const [companyPersonas, setCompanyPersonas] = useState<PersonaStudy[]>([]);
  const [isDefaultTeam, setIsDefaultTeam] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    props.benchmarkSourceStudy?.personaStudyId ?? null,
  );

  // Load initial data - personas
  useEffect(() => {
    const loadInitialData = async () => {
      const [personasResult] = await Promise.allSettled([listMyPersonas()]);

      if (personasResult.status === "fulfilled") {
        const data = personasResult.value;
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
      } else {
        clientLogger.error("Failed to load personas", {
          error: personasResult.reason,
        });
      }
    };

    loadInitialData().finally(() => {
      setIsInitialDataLoading(false);
    });
  }, []);

  // Clear connectivity error when user comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (connectivityError) {
        setConnectivityError(null);
        toast.success("You're back online", {
          description: "You can now submit your study.",
        });
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [connectivityError]);

  const hasInsufficientFunds = props.balanceCents < props.studyCostCents;

  const isEvaluateDisabled =
    loading ||
    hasInsufficientFunds ||
    (files.length === 0 && benchmarkMode !== "persona");

  const uploadFiles = async (
    filesToUpload: File[],
    studyId: string,
    metadata: (FigmaFileMetadata | null)[],
  ) => {
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
    return presigned.map((p: PresignedUploadUrl, i: number) => {
      const figmaMeta = metadata[i];
      return {
        name: filesToUpload[i].name,
        key: p.key,
        size: filesToUpload[i].size,
        type: filesToUpload[i].type,
        ...(figmaMeta && {
          figmaFileKey: figmaMeta.figmaFileKey,
          figmaNodeId: figmaMeta.figmaNodeId,
          figmaFrameName: figmaMeta.figmaFrameName,
          figmaUrl: figmaMeta.figmaUrl,
        }),
      };
    });
  };

  const handleSubmitButtonClick = async (
    data: CognitiveWalkthroughFormValues,
  ) => {
    let studyId: string | undefined;
    try {
      form.clearErrors("files");
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

      if (files.length === 0 && benchmarkMode !== "persona") {
        form.setError("files", {
          type: "manual",
          message: "At least one image file must be uploaded.",
        });
        return;
      }

      if (
        benchmarkMode === "persona" &&
        !props.benchmarkSourceStudy?.sourceFiles?.length
      ) {
        toast.error("Source study has no screens", {
          description: "The original study has no uploaded screens to reuse.",
        });
        return;
      }

      const study = await initStudy(
        data.name || null,
        "cognitive_walkthrough",
        props.benchmarkSourceStudy?.id ?? null,
      );
      studyId = study.id;
      // In persona mode, reuse the source study's files; otherwise upload new ones
      const uploadedFiles =
        benchmarkMode === "persona" &&
        props.benchmarkSourceStudy?.sourceFiles?.length
          ? props.benchmarkSourceStudy.sourceFiles
          : await uploadFiles(files, study.id, figmaMetadata);
      // Include persona data if selected
      const selected =
        personas.find((p) => p.id === selectedPersonaId) ||
        companyPersonas.find((p) => p.id === selectedPersonaId) ||
        null;
      await finalizeAndQueueStudy("cognitive_walkthrough", study.id, {
        name: data.name || undefined,
        goal: data.goal || undefined,
        user: selected ? "" : data.user || undefined,
        context: data.context || undefined,
        files: uploadedFiles,
        persona: selected
          ? {
              studyId: selected.id,
              name: selected?.persona?.name || selected?.name || undefined,
              description: selected?.persona?.description || undefined,
              data: selected?.persona?.data || undefined,
            }
          : undefined,
        benchmarkContext: props.benchmarkSourceStudy?.benchmarkContext
          ? {
              ...props.benchmarkSourceStudy.benchmarkContext,
              mode: benchmarkMode,
            }
          : undefined,
      });
    } catch (error) {
      // Allow framework redirect errors to propagate so navigation proceeds
      const isNextRedirect =
        (error as any)?.digest?.toString?.().startsWith?.("NEXT_REDIRECT") ||
        (error as any)?.message?.includes?.("NEXT_REDIRECT");
      if (isNextRedirect) {
        throw error;
      }

      // Clean up orphaned study if it was created but not finalized
      if (studyId) {
        await cleanupOrphanedStudy(studyId);
      }

      clientLogger.error("Error submitting cognitive walkthrough", {
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
        form.setError("files", {
          type: "manual",
          message,
        });
      }

      // Show toast notification with appropriate title
      const toastTitle = isOffline()
        ? "You're offline"
        : "Failed to submit study";
      toast.error(toastTitle, {
        description: message,
      });

      setLoading(false);
    }
  };

  return (
    <div>
      {isBenchmark && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <strong>Benchmark mode:</strong>{" "}
          {benchmarkMode === "persona"
            ? "Select a new persona to compare against the original walkthrough. The flow and other settings are locked."
            : "Upload a new flow to compare against the original walkthrough. The persona and other settings are locked."}
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmitButtonClick)}
          autoComplete="off"
          className="flex min-w-0 flex-col gap-6 pb-20"
        >
          {/* File Upload (primary field) — hidden when benchmarking persona only */}
          {(!isBenchmark || benchmarkMode === "flow") && (
            <FormField
              control={form.control}
              name="files"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>
                    What are the steps in your user journey?
                  </FormLabel>
                  <FormDescription>
                    Upload screenshots or a video showing each step the user
                    takes to complete their goal. Drag and drop files below,
                    click to upload, or import from a Figma prototype.
                  </FormDescription>
                  <FormControl className="flex min-w-0 flex-1 flex-col">
                    <div className="flex min-h-[300px] min-h-[calc(100dvh-21rem)] min-w-0 flex-col">
                      <Input
                        {...fieldProps}
                        accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
                        className="hidden"
                        multiple={true}
                        onChange={(e) => {
                          onChange(
                            e.target.files ? Array.from(e.target.files) : [],
                          );
                          handleFileInputChange(e);
                        }}
                        ref={fileInputRef}
                        type="file"
                        disabled={isInteractionDisabled || isUploadDisabled}
                      />
                      <FileUploadZone
                        isInteractionDisabled={
                          isInteractionDisabled || isUploadDisabled
                        }
                        onUploadClick={handleUploadButtonClick}
                        onDrag={handleDrag}
                        onDrop={handleDrop}
                        className="min-h-[120px] flex-1"
                      >
                        {videoExtractionProgress && (
                          <VideoExtractionProgress
                            progress={videoExtractionProgress}
                          />
                        )}
                        <FigmaImportSection
                          figmaConnected={figmaConnected}
                          figmaUrl={figmaUrl}
                          figmaLoading={figmaLoading}
                          figmaError={figmaError}
                          isInteractionDisabled={
                            isInteractionDisabled || isUploadDisabled
                          }
                          onConnectionChange={setFigmaConnected}
                          onUrlChange={setFigmaUrl}
                          onImport={handleFigmaImport}
                        />
                      </FileUploadZone>

                      <FileCardList
                        files={files}
                        isLoading={isCardListLoading}
                        isInteractionDisabled={
                          isInteractionDisabled || isUploadDisabled
                        }
                        sortDirection={sortDirection}
                        onSortToggle={handleSortToggle}
                        onMoveCard={moveCard}
                        onDeleteCard={handleDeleteButtonClick}
                      />
                      {files.length > LONG_FLOW_WARNING_THRESHOLD && (
                        <LongFlowWarning />
                      )}
                      {showFigmaFrameWarning && <FigmaFramesOnlyWarning />}
                      <FormMessage className="mt-2" />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {/* Optional Fields Toggle — hidden in benchmark mode */}
          {!isBenchmark && (
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
          )}

          {/* Benchmark mode: show only the editable field */}
          {isBenchmark && (
            <div className="flex flex-col gap-6">
              {/* Persona select — only shown in persona mode */}
              {benchmarkMode === "persona" && (
                <FormField
                  control={form.control}
                  name="user"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who is the target user?</FormLabel>
                      <FormControl>
                        {isInitialDataLoading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <PersonaSelect
                            privatePersonas={privatePersonas}
                            personas={personas}
                            companyPersonas={companyPersonas}
                            selectedId={selectedPersonaId}
                            inputValue={field.value || ""}
                            onChange={({ selectedId, inputValue }) => {
                              setSelectedPersonaId(selectedId);
                              form.setValue("user", inputValue);
                            }}
                            getImageUrl={getPersonaImageUrl}
                            placeholder="Select a persona or type a description e.g., A busy working parent"
                            isDefaultTeam={isDefaultTeam}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          {/* Non-benchmark optional fields */}
          {!isBenchmark && showOptionalFields && (
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
                        placeholder="Enter a name for the study e.g., Recipe Search"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* User Goal */}
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      What is the user trying to accomplish?
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter the goal the user is trying to achieve e.g., Find a recipe"
                        {...field}
                        disabled={lockMeta}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target User / Persona */}
              <FormField
                control={form.control}
                name="user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who is the target user?</FormLabel>
                    <FormControl>
                      {isInitialDataLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <PersonaSelect
                          privatePersonas={privatePersonas}
                          personas={personas}
                          companyPersonas={companyPersonas}
                          selectedId={selectedPersonaId}
                          inputValue={field.value || ""}
                          onChange={({ selectedId, inputValue }) => {
                            setSelectedPersonaId(selectedId);
                            form.setValue("user", inputValue);
                          }}
                          getImageUrl={getPersonaImageUrl}
                          placeholder="Select a persona or type a description e.g., A busy working parent"
                          isDefaultTeam={isDefaultTeam}
                          disabled={lockPersona}
                        />
                      )}
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
                    <FormLabel>
                      What additional information would be helpful?
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter additional context for the evaluation e.g., the user is browsering a recipe website on their laptop"
                        {...field}
                        disabled={lockMeta}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <StickyFormFooter>
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                className="w-32 shrink-0"
                disabled={isEvaluateDisabled}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evaluate
              </Button>
              {hasInsufficientFunds && (
                <InsufficientFundsMessage
                  balanceCents={props.balanceCents}
                  costCents={props.studyCostCents}
                  canPurchaseCredits={props.canPurchaseCredits}
                  teamName={props.teamName}
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
