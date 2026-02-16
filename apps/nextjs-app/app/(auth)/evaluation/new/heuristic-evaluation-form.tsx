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

// Component imports
import { Loader2 } from "lucide-react";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import { LongFlowWarning } from "@/apps/nextjs-app/components/study/long-flow-warning";
import { FigmaFramesOnlyWarning } from "@/apps/nextjs-app/components/study/figma-frames-only-warning";
import { VideoExtractionProgress } from "@/apps/nextjs-app/components/study/video-extraction-progress";
import { FigmaImportSection } from "@/apps/nextjs-app/components/study/figma-import-section";
import { FileUploadZone } from "@/apps/nextjs-app/components/study/file-upload-zone";
import { FileCardList } from "@/apps/nextjs-app/components/study/file-card-list";

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
} from "@/apps/nextjs-app/app/(auth)/evaluation/new/heuristic-select";
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

export function HeuristicEvaluationForm(props: {
  balanceCents: number;
  studyCostCents: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
  pluginSession?: PluginSessionData | null;
}) {
  const { checkSession } = useSessionCheck();

  const [loading, setLoading] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);

  const schema = useMemo(
    () => createHeuristicEvaluationSchema(props.maxFiles),
    [props.maxFiles],
  );

  const form = useForm<HeuristicEvaluationFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: props.pluginSession?.fileName || "",
      goal: "",
      user: "",
      files: [],
      heuristic: "",
      context: "",
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
    null,
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
        setHeuristicFamilies(Array.isArray(data) ? data : []);
      } else {
        clientLogger.error("Failed to load heuristic families", {
          error: heuristicsResult.reason,
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

  const { isValid } = form.formState;
  const isEvaluateDisabled =
    loading || props.balanceCents < props.studyCostCents || !isValid;

  const validateData = useCallback(
    (data: HeuristicEvaluationFormValues) => {
      const newHeuristicEvaluation = {
        name: data.name,
        goal: data.goal,
        user: data.user,
        files: files,
        heuristic: data.heuristic,
        context: data.context,
      };

      const result = schema.safeParse(newHeuristicEvaluation);

      return result;
    },
    [files, schema],
  );

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

      const validation = validateData(data);
      if (!validation.success) {
        // Access error from SafeParseError - validation.error is typed correctly
        const firstIssue = validation.error?.issues?.[0];
        const fieldName = firstIssue?.path?.[0];
        const message = firstIssue?.message || "Invalid form data.";
        // Use type guard to validate field name before setting error
        if (
          typeof fieldName === "string" &&
          ["name", "goal", "user", "files", "heuristic", "context"].includes(
            fieldName,
          )
        ) {
          form.setError(fieldName as keyof HeuristicEvaluationFormValues, {
            type: "manual",
            message,
          });
        } else {
          form.setError("files", { type: "manual", message });
        }
        return;
      }
      if (files.length === 0) {
        form.setError("files", {
          type: "manual",
          message: "At least one image file must be uploaded.",
        });
        return;
      }
      const study = await initStudy(data.name, "heuristic_evaluation");
      studyId = study.id; // Track studyId for cleanup if needed
      const uploadedFiles = await uploadFiles(files, study.id, figmaMetadata);
      // Include persona data if selected; if a persona is selected, leave `user` empty
      // Search both team and company personas
      const selected =
        personas.find((p) => p.id === selectedPersonaId) ||
        companyPersonas.find((p) => p.id === selectedPersonaId) ||
        null;
      await finalizeAndQueueStudy("heuristic_evaluation", study.id, {
        name: data.name,
        goal: data.goal,
        user: selected ? "" : data.user,
        context: data.context,
        heuristic: data.heuristic,
        files: uploadedFiles,
        persona: selected
          ? {
              studyId: selected.id,
              name: selected?.persona?.name || selected?.name || undefined,
              description: selected?.persona?.description || undefined,
              data: selected?.persona?.data || undefined,
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
        ? "You're offline"
        : "Failed to submit study";
      toast.error(toastTitle, {
        description: message,
      });

      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden">
      <Form {...form}>
        <form
          // action={heuristicEvaluationFormActionPreProcessing}
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
                    placeholder="Enter a name for the study e.g., Recipe Search"
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
                <FormLabel>What is the user trying to accomplish?</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter the goal the user is trying to achieve e.g., Find a recipe"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                      placeholder="Select a persona or type a description  e.g., A busy working parent"
                      isDefaultTeam={isDefaultTeam}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="files"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>What are the steps in your user journey?</FormLabel>
                <FormDescription>
                  Upload screenshots or a video showing each step the user takes
                  to complete their goal. Drag and drop files below, click
                  Upload to select them, or import from a Figma prototype.
                </FormDescription>
                <FormControl className="overflow-hidden">
                  <div className="overflow-hidden">
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
                      disabled={isInteractionDisabled}
                    />
                    <FileUploadZone
                      isInteractionDisabled={isInteractionDisabled}
                      onUploadClick={handleUploadButtonClick}
                      onDrag={handleDrag}
                      onDrop={handleDrop}
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
                        isInteractionDisabled={isInteractionDisabled}
                        onConnectionChange={setFigmaConnected}
                        onUrlChange={setFigmaUrl}
                        onImport={handleFigmaImport}
                      />
                    </FileUploadZone>

                    <FileCardList
                      files={files}
                      isLoading={isCardListLoading}
                      isInteractionDisabled={isInteractionDisabled}
                      sortDirection={sortDirection}
                      onSortToggle={handleSortToggle}
                      onMoveCard={moveCard}
                      onDeleteCard={handleDeleteButtonClick}
                    />
                    {files.length > LONG_FLOW_WARNING_THRESHOLD && (
                      <LongFlowWarning />
                    )}
                    {showFigmaFrameWarning && <FigmaFramesOnlyWarning />}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="heuristic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Which evaluation heuristics would you like to use?
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
                        // Set the heuristic field to the family ID (UUID) which the backend uses to fetch heuristics
                        form.setValue("heuristic", selectedId || "", {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                      placeholder="Select a heuristic set"
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
                    placeholder="Enter additional context for the evaluation e.g., the user is browsering a recipe website on their laptop"
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
              isEvaluateDisabled ||
              loading ||
              props.balanceCents < props.studyCostCents
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Evaluate
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
