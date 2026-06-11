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
  createHeuristicEvaluationSchema,
  type HeuristicEvaluationFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";

// Component imports
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import { LongFlowWarning } from "@/apps/nextjs-app/components/study/long-flow-warning";
import { FigmaFramesOnlyWarning } from "@/apps/nextjs-app/components/study/figma-frames-only-warning";
import { VideoExtractionProgress } from "@/apps/nextjs-app/components/study/video-extraction-progress";
import { FigmaImportSection } from "@/apps/nextjs-app/components/study/figma-import-section";
import { FileUploadZone } from "@/apps/nextjs-app/components/study/file-upload-zone";
import { FileCardList } from "@/apps/nextjs-app/components/study/file-card-list";
import { StickyFormFooter } from "@/apps/nextjs-app/components/study/sticky-form-footer";
import { InsufficientFundsMessage } from "@/apps/nextjs-app/components/funds/insufficient-funds-message";

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
import {
  HeuristicSelect,
  type HeuristicFamily,
} from "@/apps/nextjs-app/app/[locale]/(auth)/evaluation/new/heuristic-select";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";
import { listMyHeuristicFamilies } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
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
  heuristicId?: string | null;
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

export function HeuristicEvaluationForm(props: {
  balanceCents: number;
  studyCostCents: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
  teamName?: string | null;
  pluginSession?: PluginSessionData | null;
  benchmarkSourceStudy?: BenchmarkSourceStudy | null;
}) {
  const { checkSession } = useSessionCheck();
  const tc = useTranslations("StudyWizardForms.common");
  const th = useTranslations("StudyWizardForms.heuristic");
  const tv = useTranslations("StudyWizardForms.validation");
  const locale = useLocale();

  const isBenchmark = !!props.benchmarkSourceStudy;
  const benchmarkMode = props.benchmarkSourceStudy?.mode;
  // flow mode: only files are editable; persona mode: only persona is editable
  const lockPersona = isBenchmark && benchmarkMode !== "persona";
  const lockFlow = isBenchmark && benchmarkMode !== "flow";
  const lockMeta = isBenchmark; // goal, context, heuristic always locked in benchmark

  // File upload interactions are disabled either by loading state or when flow is locked
  const isUploadDisabled = lockFlow;
  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [showOptionalFields, setShowOptionalFields] = useState(isBenchmark);

  const schema = useMemo(
    () =>
      createHeuristicEvaluationSchema(
        props.maxFiles,
        benchmarkMode === "persona",
        tv,
      ),
    [props.maxFiles, benchmarkMode, tv],
  );

  const form = useForm<HeuristicEvaluationFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: props.pluginSession?.fileName || "",
      goal: props.benchmarkSourceStudy?.goal || "",
      user: props.benchmarkSourceStudy?.user || "",
      files: [],
      heuristic: props.benchmarkSourceStudy?.heuristicId || "",
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

  // Heuristic families state
  const [heuristicFamilies, setHeuristicFamilies] = useState<HeuristicFamily[]>(
    [],
  );
  const [selectedHeuristicId, setSelectedHeuristicId] = useState<string | null>(
    null,
  );

  // Load initial data - personas and heuristic families in parallel
  useEffect(() => {
    const loadInitialData = async () => {
      const [personasResult, heuristicsResult] = await Promise.allSettled([
        listMyPersonas(),
        listMyHeuristicFamilies(),
      ]);

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

      if (heuristicsResult.status === "fulfilled") {
        const data = heuristicsResult.value;
        clientLogger.info("Loaded heuristic families", {
          count: data?.length || 0,
          families: data?.map((f: HeuristicFamily) => ({
            key: f.key,
            name: f.name,
          })),
        });
        const families = Array.isArray(data) ? data : [];
        setHeuristicFamilies(families);

        // Auto-select saved heuristic or fallback to Nielsen heuristics as default
        // In benchmark mode, use the source study's heuristic
        if (props.benchmarkSourceStudy?.heuristicId) {
          const sourceHeuristic = families.find(
            (f: HeuristicFamily) =>
              f.id === props.benchmarkSourceStudy!.heuristicId,
          );
          if (sourceHeuristic) {
            setSelectedHeuristicId(sourceHeuristic.id);
            form.setValue("heuristic", sourceHeuristic.id, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }
        } else {
          const savedHeuristicId =
            typeof window !== "undefined"
              ? localStorage.getItem("seer_last_heuristic_id")
              : null;
          const savedHeuristic = savedHeuristicId
            ? families.find((f: HeuristicFamily) => f.id === savedHeuristicId)
            : null;

          const defaultHeuristic =
            savedHeuristic ||
            families.find(
              (f: HeuristicFamily) => f.key.toUpperCase() === "NIELSEN",
            );

          if (defaultHeuristic) {
            setSelectedHeuristicId(defaultHeuristic.id);
            form.setValue("heuristic", defaultHeuristic.id, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }
        } // end else (not benchmark)
      } else {
        clientLogger.error("Failed to load heuristic families", {
          error: heuristicsResult.reason,
        });
      }
    };

    loadInitialData().finally(() => {
      setIsInitialDataLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear connectivity error when user comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (connectivityError) {
        setConnectivityError(null);
        toast.success(tc("backOnlineTitle"), {
          description: tc("backOnlineDesc"),
        });
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [connectivityError, tc]);

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
    data: HeuristicEvaluationFormValues,
  ) => {
    let studyId: string | undefined;
    try {
      form.clearErrors("files");
      setConnectivityError(null);
      setLoading(true);

      // Check if user is offline before proceeding
      if (isOffline()) {
        setConnectivityError(tc("offlineError"));
        toast.error(tc("offlineTitle"), {
          description: tc("offlineDesc"),
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
          message: tv("filesMinImages"),
        });
        return;
      }

      if (
        benchmarkMode === "persona" &&
        !props.benchmarkSourceStudy?.sourceFiles?.length
      ) {
        toast.error(tc("sourceNoScreensTitle"), {
          description: tc("sourceNoScreensDesc"),
        });
        return;
      }

      const study = await initStudy(
        data.name || null,
        "heuristic_evaluation",
        props.benchmarkSourceStudy?.id ?? null,
        locale,
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
      await finalizeAndQueueStudy("heuristic_evaluation", study.id, {
        name: data.name || undefined,
        goal: data.goal || undefined,
        user: selected ? "" : data.user || undefined,
        context: data.context || undefined,
        heuristic: data.heuristic || selectedHeuristicId || "",
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

      clientLogger.error("Error submitting heuristic evaluation", {
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
        ? tc("offlineTitle")
        : tc("failedSubmitTitle");
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
          <strong>{th("benchmarkTitle")}</strong>{" "}
          {benchmarkMode === "persona"
            ? th("benchmarkPersonaDesc")
            : th("benchmarkFlowDesc")}
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
                    {th("stepsLabel")}
                  </FormLabel>
                  <FormDescription>
                    {th("stepsDesc")}
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
              {showOptionalFields ? tc("lessIsMore") : tc("knowSomething")}
            </Button>
          )}

          {/* Benchmark mode: show only the editable field */}
          {isBenchmark && (
            <div className="flex flex-col gap-6">
              {benchmarkMode === "persona" && (
                <FormField
                  control={form.control}
                  name="user"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tc("targetUserLabel")}</FormLabel>
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
                            placeholder={tc("targetUserPlaceholder")}
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
                      {tc("nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tc("namePlaceholder")}
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
                      {tc("goalLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tc("goalPlaceholder")}
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
                    <FormLabel>{tc("targetUserLabel")}</FormLabel>
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
                          placeholder={tc("targetUserPlaceholder")}
                          isDefaultTeam={isDefaultTeam}
                          disabled={lockPersona}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Heuristic Selection */}
              <FormField
                control={form.control}
                name="heuristic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {th("heuristicsLabel")}
                    </FormLabel>
                    <FormControl>
                      {isInitialDataLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <HeuristicSelect
                          heuristicFamilies={heuristicFamilies}
                          selectedId={selectedHeuristicId}
                          onChange={({ selectedId, family }) => {
                            setSelectedHeuristicId(selectedId);
                            if (typeof window !== "undefined") {
                              if (selectedId) {
                                localStorage.setItem(
                                  "seer_last_heuristic_id",
                                  selectedId,
                                );
                              } else {
                                localStorage.removeItem(
                                  "seer_last_heuristic_id",
                                );
                              }
                            }
                            form.setValue("heuristic", selectedId || "", {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }}
                          placeholder={th("heuristicsPlaceholder")}
                          disabled={lockMeta}
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
                      {tc("contextLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tc("contextPlaceholder")}
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
                {tc("evaluate")}
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
