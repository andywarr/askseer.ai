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
import {
  isVideoFile,
  extractFramesFromVideo,
  VideoExtractionError,
  type ExtractionProgress,
} from "@/apps/nextjs-app/utils/video-frame-extractor";

// React imports
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

// Schema imports
import {
  createHeuristicEvaluationSchema,
  type HeuristicEvaluationFormValues,
} from "@/apps/nextjs-app/lib/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";

// Component imports
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import DraggableFileCard from "@/apps/nextjs-app/components/figma/draggable-file-card";
import { AArrowDown, AArrowUp, Loader2 } from "lucide-react";
import { LONG_FLOW_WARNING_THRESHOLD } from "@/apps/nextjs-app/lib/utils/constants";
import { LongFlowWarning } from "@/apps/nextjs-app/components/study/long-flow-warning";
import { FigmaFramesOnlyWarning } from "@/apps/nextjs-app/components/study/figma-frames-only-warning";
import { VideoExtractionProgress } from "@/apps/nextjs-app/app/(auth)/evaluation/new/video-extraction-progress";
import { FigmaImportSection } from "@/apps/nextjs-app/app/(auth)/evaluation/new/figma-import-section";
import { FileUploadZone } from "@/apps/nextjs-app/app/(auth)/evaluation/new/file-upload-zone";
import { FileCardList } from "@/apps/nextjs-app/app/(auth)/evaluation/new/file-card-list";

// UI Component imports
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

// Other imports
import update from "immutability-helper";
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
import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import type { FigmaFileMetadata } from "@/apps/nextjs-app/types/types";

import { useSessionCheck } from "@/apps/nextjs-app/hooks/use-session-check";
import {
  importFigmaImages,
  checkFigmaConnection,
} from "@/apps/nextjs-app/lib/figma/actions";
import { FigmaConnectButton } from "@/apps/nextjs-app/components/figma/figma-connect-button";
import type { PluginSessionData } from "@/apps/nextjs-app/lib/auth/plugin-session";


// Type for presigned upload URL response
type PresignedUploadUrl = {
  key: string;
  uploadURL: string;
};

// Constants for scroll shadow gradients
const EDGE_FADE_COLOR = "255, 255, 255";
const RIGHT_EDGE_GRADIENT = `linear-gradient(to right, rgba(${EDGE_FADE_COLOR}, 1) 0%, rgba(${EDGE_FADE_COLOR}, 0.6) 60%, rgba(${EDGE_FADE_COLOR}, 0) 100%)`;
const LEFT_EDGE_GRADIENT = `linear-gradient(to left, rgba(${EDGE_FADE_COLOR}, 1) 0%, rgba(${EDGE_FADE_COLOR}, 0.6) 60%, rgba(${EDGE_FADE_COLOR}, 0) 100%)`;

export function HeuristicEvaluationForm(props: {
  credits: number;
  maxFiles: number;
  canPurchaseCredits?: boolean;
  pluginSession?: PluginSessionData | null;
}) {
  const { checkSession } = useSessionCheck();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  // Track Figma metadata for each file by index (null for non-Figma files)
  const [figmaMetadata, setFigmaMetadata] = useState<
    (FigmaFileMetadata | null)[]
  >([]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const hasUserInteractedWithFiles = useRef(false);
  const [loading, setLoading] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState<string>("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string>("");
  const [isCardListLoading, setIsCardListLoading] = useState(false);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [showFigmaFrameWarning, setShowFigmaFrameWarning] = useState(false);
  const [connectivityError, setConnectivityError] = useState<string | null>(
    null,
  );
  const [videoExtractionProgress, setVideoExtractionProgress] =
    useState<ExtractionProgress | null>(null);

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

      // Handle personas result
      if (personasResult.status === "fulfilled") {
        const data = personasResult.value;
        // Cast to PersonaStudy[] - the API data is structurally compatible
        // but uses index signature, so we need to cast through unknown
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

      // Handle heuristics result
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

    loadInitialData();
  }, []);

  // Load plugin session frames if present
  useEffect(() => {
    if (!props.pluginSession?.frames?.length) return;

    const loadPluginFrames = async () => {
      setIsCardListLoading(true);
      try {
        const loadedFiles: File[] = [];
        const loadedMetadata: (FigmaFileMetadata | null)[] = [];

        for (const frame of props.pluginSession!.frames) {
          if (!frame.url) continue;

          try {
            const response = await fetch(frame.url);
            const blob = await response.blob();
            const file = new File([blob], `${frame.name}.png`, {
              type: "image/png",
            });
            loadedFiles.push(file);

            // Add Figma metadata for the frame
            loadedMetadata.push({
              figmaFileKey: "",
              figmaNodeId: frame.nodeId,
              figmaFrameName: frame.name,
              figmaUrl: "",
            });
          } catch (error) {
            clientLogger.warn("Failed to import plugin frame", {
              frameName: frame.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (loadedFiles.length > 0) {
          setFiles(loadedFiles);
          setFigmaMetadata(loadedMetadata);
          hasUserInteractedWithFiles.current = true;

          toast.success(
            `${loadedFiles.length} frame${loadedFiles.length !== 1 ? "s" : ""} imported from Figma`,
          );
        }
      } catch (error) {
        clientLogger.error("Failed to import plugin session frames", {
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error("Failed to import Figma frames", {
          description: "Please try importing again.",
        });
      } finally {
        setIsCardListLoading(false);
      }
    };

    loadPluginFrames();
  }, [props.pluginSession]);

  // Sync files state with form state
  useEffect(() => {
    if (files.length === 0 && !hasUserInteractedWithFiles.current) {
      return;
    }

    hasUserInteractedWithFiles.current = true;

    form.setValue("files", files, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [files, form]);

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

  useEffect(() => {
    if (isCardListLoading && files.length > 0) {
      setIsCardListLoading(false);
    }
  }, [files, isCardListLoading]);

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = update(prevFiles, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevFiles[dragIndex]],
        ],
      });
      return updatedFiles;
    });
    setFigmaMetadata((prevMetadata) => {
      const updatedMetadata = update(prevMetadata, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevMetadata[dragIndex]],
        ],
      });
      return updatedMetadata;
    });
  }, []);

  const handleDeleteButtonClick = useCallback((index: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index);
      return updatedFiles;
    });
    setFigmaMetadata((prevMetadata) => {
      const updatedMetadata = prevMetadata.filter((_, i) => i !== index);
      return updatedMetadata;
    });
  }, []);

  const renderCard = useCallback(
    (file: File, index: number) => {
      return (
        <DraggableFileCard
          key={index}
          index={index}
          file={file}
          cards={files.length}
          moveCard={moveCard}
          deleteCard={handleDeleteButtonClick}
        />
      );
    },
    [files.length, handleDeleteButtonClick, moveCard],
  );

  const isInteractionDisabled =
    isCardListLoading || figmaLoading || videoExtractionProgress !== null;

  const { isValid } = form.formState;
  const isEvaluateDisabled = loading || props.credits <= 0 || !isValid;

  const updateScrollShadows = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      setShowLeftShadow(false);
      setShowRightShadow(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScroll = scrollWidth - clientWidth > 1;

    setShowLeftShadow(canScroll && scrollLeft > 0);
    setShowRightShadow(canScroll && scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollShadows();
  }, [files, updateScrollShadows]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollShadows();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateScrollShadows]);

  /**
   * Process uploaded files - extracts frames from videos, passes images through
   */
  const processUploadedFiles = useCallback(
    async (inputFiles: File[]): Promise<File[]> => {
      const imageFiles: File[] = [];
      const videoFiles: File[] = [];

      // Separate images and videos
      for (const file of inputFiles) {
        if (isVideoFile(file)) {
          videoFiles.push(file);
        } else {
          imageFiles.push(file);
        }
      }

      // If no videos, return images directly
      if (videoFiles.length === 0) {
        return imageFiles;
      }

      // Process videos one at a time and extract frames
      const extractedFrames: File[] = [];

      for (const video of videoFiles) {
        try {
          const result = await extractFramesFromVideo(
            video,
            setVideoExtractionProgress,
          );
          extractedFrames.push(...result.frames);
        } catch (error) {
          if (error instanceof VideoExtractionError) {
            toast.error(`Video error: ${error.message}`);
          } else {
            clientLogger.error("Video frame extraction failed", {
              error:
                error instanceof Error
                  ? { message: error.message }
                  : (error ?? "unknown"),
              videoName: video.name,
            });
            toast.error(`Failed to extract frames from "${video.name}"`);
          }
        }
      }

      setVideoExtractionProgress(null);
      return [...imageFiles, ...extractedFrames];
    },
    [],
  );

  const handleUploadButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (isInteractionDisabled || !fileInputRef.current) return;

      fileInputRef.current.click();
    },
    [isInteractionDisabled],
  );

  const handleDrag = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (isInteractionDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [isInteractionDisabled],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (isInteractionDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles: Array<File> = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) {
        setIsCardListLoading(false);
        return;
      }
      setIsCardListLoading(true);

      // Process files (extract frames from videos)
      const processedFiles = await processUploadedFiles(droppedFiles);

      if (processedFiles.length > 0) {
        setFiles((prevFiles) => [...prevFiles, ...processedFiles]);
        // Add null metadata for non-Figma files
        setFigmaMetadata((prevMetadata) => [
          ...prevMetadata,
          ...processedFiles.map(() => null),
        ]);
      }

      setIsCardListLoading(false);
    },
    [isInteractionDisabled, processUploadedFiles],
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (isInteractionDisabled) {
        return;
      }
      const selectedFiles: Array<File> = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) {
        setIsCardListLoading(false);
        return;
      }
      setIsCardListLoading(true);

      // Process files (extract frames from videos)
      const processedFiles = await processUploadedFiles(selectedFiles);

      if (processedFiles.length > 0) {
        setFiles((prevFiles) => [...prevFiles, ...processedFiles]);
        // Add null metadata for non-Figma files
        setFigmaMetadata((prevMetadata) => [
          ...prevMetadata,
          ...processedFiles.map(() => null),
        ]);
      }

      setIsCardListLoading(false);
      // Reset the input value so the same file can be selected again
      e.target.value = "";
    },
    [isInteractionDisabled, processUploadedFiles],
  );

  const handleSortToggle = useCallback(() => {
    // Create an array of indices to track original positions
    const indexedFiles = files.map((file, index) => ({ file, index }));
    indexedFiles.sort((a, b) => {
      const comparison = a.file.name.localeCompare(b.file.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });

    setFiles(indexedFiles.map(({ file }) => file));
    setFigmaMetadata((prevMetadata) =>
      indexedFiles.map(({ index }) => prevMetadata[index]),
    );
    setSortDirection((prevDirection) =>
      prevDirection === "asc" ? "desc" : "asc",
    );
  }, [files, sortDirection]);

  const fetchFigmaImages = async (url: string) => {
    try {
      setIsCardListLoading(true);
      setFigmaLoading(true);
      setFigmaError("");
      setShowFigmaFrameWarning(false);

      // Use OAuth-based server action to import Figma images
      const result = await importFigmaImages(url);

      if (!result.success) {
        setFigmaError(result.error || "Failed to import from Figma.");
        setIsCardListLoading(false);
        return;
      }

      // Show warning if other elements were skipped during import
      if (result.hasOtherElements) {
        setShowFigmaFrameWarning(true);
      }

      // Convert base64 images to File objects
      const imageFiles: File[] = [];
      for (const fileData of result.files || []) {
        const byteString = atob(fileData.data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "image/png" });
        const file = new File([blob], fileData.name, { type: "image/png" });
        imageFiles.push(file);
      }

      clientLogger.info("Importing frames from Figma via OAuth", {
        frameCount: imageFiles.length,
      });

      setFiles((prevFiles) => [...prevFiles, ...imageFiles]);

      // Store Figma metadata for each imported file
      const newMetadata: FigmaFileMetadata[] = (result.files || []).map(
        (fileData) => ({
          figmaFileKey: result.figmaFileKey || "",
          figmaNodeId: fileData.nodeId,
          figmaFrameName: fileData.frameName || "",
          figmaUrl: result.figmaUrl || "",
        }),
      );
      setFigmaMetadata((prevMetadata) => [...prevMetadata, ...newMetadata]);

      setFigmaUrl("");

      clientLogger.info("Successfully imported screens from Figma", {
        frameCount: imageFiles.length,
      });
    } catch (error) {
      clientLogger.error("Error fetching Figma images", {
        error:
          error instanceof Error
            ? { message: error.message }
            : (error ?? "unknown"),
      });
      setFigmaError(
        error instanceof Error
          ? error.message
          : "Failed to import the user journey from Figma.",
      );
      setIsCardListLoading(false);
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaImport = useCallback(() => {
    if (isInteractionDisabled) {
      return;
    }
    if (!figmaUrl.trim()) {
      setFigmaError("Enter a valid Figma prototype URL");
      return;
    }
    fetchFigmaImages(figmaUrl);
  }, [isInteractionDisabled, figmaUrl]);

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
    files: File[],
    studyId: string,
    metadata: (FigmaFileMetadata | null)[],
  ) => {
    const fileMetadata = files.map((file: File) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    const presigned = await getStudyUploadUrls(studyId, fileMetadata);

    // Upload files with retry logic and concurrency limiting
    // This prevents "Failed to fetch" errors caused by too many concurrent uploads
    await uploadFilesWithConcurrencyLimit(
      presigned,
      async (urlData: PresignedUploadUrl, index: number) => {
        const file: File = files[index];
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
        name: files[i].name,
        key: p.key,
        size: files[i].size,
        type: files[i].type,
        // Include Figma metadata if available
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
        const firstIssue =
          // zod v3 uses .issues, earlier code elsewhere referenced .errors
          (validation as any)?.error?.issues?.[0] ||
          (validation as any)?.error?.errors?.[0];
        const fieldName =
          (firstIssue?.path?.[0] as keyof HeuristicEvaluationFormValues) ||
          ("files" as keyof HeuristicEvaluationFormValues);
        const message = firstIssue?.message || "Invalid form data.";
        form.setError(fieldName as any, { type: "manual", message });
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
                    getImageUrl={async (key: string) => {
                      try {
                        const result = await getPresignedUrls(key);
                        return result.success && result.data ? result.data : "";
                      } catch {
                        return "";
                      }
                    }}
                    placeholder="Select a persona or type a description  e.g., A busy working parent"
                    isDefaultTeam={isDefaultTeam}
                  />
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
                    <div
                      onDragOver={handleDrag}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      aria-disabled={isInteractionDisabled}
                      className={`border-blue-gray-300 flex w-full max-w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4 ${isInteractionDisabled ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="mx-auto h-4 w-4"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        ></path>
                      </svg>
                      <Button
                        variant="outline"
                        onClick={handleUploadButtonClick}
                        disabled={isInteractionDisabled}
                      >
                        Upload
                      </Button>
                      <p className="text-muted-foreground text-sm">
                        Supported formats: .png, .jpg, .mp4, .webm, .mov
                      </p>
                      {/* Video extraction progress indicator */}
                      {videoExtractionProgress && (
                        <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                          <div className="flex items-center gap-2">
                            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                            <span className="text-muted-foreground text-sm font-medium">
                              {videoExtractionProgress.message}
                            </span>
                          </div>
                          {videoExtractionProgress.total > 0 && (
                            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className="h-full bg-zinc-500 transition-all duration-200 dark:bg-zinc-400"
                                style={{
                                  width: `${(videoExtractionProgress.current / videoExtractionProgress.total) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {/* OAuth flow: show connect button or import input based on connection status */}
                      {figmaConnected ? (
                        <div className="flex w-full gap-2">
                          <Input
                            type="text"
                            placeholder="Enter a link to a Figma file or prototype"
                            className="flex-1"
                            value={figmaUrl}
                            onChange={(e) => setFigmaUrl(e.target.value)}
                            disabled={isInteractionDisabled}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleFigmaImport}
                            disabled={isInteractionDisabled || !figmaUrl.trim()}
                          >
                            {figmaLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Import"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <FigmaConnectButton
                          onConnectionChange={setFigmaConnected}
                        />
                      )}
                      {figmaError && (
                        <p className="text-[0.8rem] font-medium text-red-500">
                          {figmaError}
                        </p>
                      )}
                    </div>

                    <DndProviderComponent>
                      {(files.length > 0 || isCardListLoading) && (
                        <div className="mt-4 space-y-4 overflow-hidden">
                          {files.length > 1 && (
                            <div className="mb-2 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleSortToggle}
                                disabled={isInteractionDisabled}
                                className="h-8 w-8 p-0"
                                aria-label={
                                  sortDirection === "asc"
                                    ? "Sort ascending"
                                    : "Sort descending"
                                }
                              >
                                {sortDirection === "asc" ? (
                                  <>
                                    <AArrowUp aria-hidden className="h-4 w-4" />
                                    <span className="sr-only">
                                      Sort ascending
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AArrowDown
                                      aria-hidden
                                      className="h-4 w-4"
                                    />
                                    <span className="sr-only">
                                      Sort descending
                                    </span>
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          {isCardListLoading && (
                            <div className="flex min-h-[70px] items-center justify-center">
                              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                            </div>
                          )}
                          <div className="relative overflow-hidden">
                            <div
                              ref={scrollContainerRef}
                              onScroll={updateScrollShadows}
                              className="flex gap-4 overflow-x-auto pb-2"
                            >
                              {files.map((file, index) => {
                                return renderCard(file, index);
                              })}
                            </div>
                            {showLeftShadow && (
                              <div
                                className="pointer-events-none absolute inset-y-0 left-0 w-12"
                                style={{ background: RIGHT_EDGE_GRADIENT }}
                              />
                            )}
                            {showRightShadow && (
                              <div
                                className="pointer-events-none absolute inset-y-0 right-0 w-12"
                                style={{ background: LEFT_EDGE_GRADIENT }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </DndProviderComponent>
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
            disabled={isEvaluateDisabled || loading || props.credits <= 0}
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
