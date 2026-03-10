"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import update from "immutability-helper";

import {
  isVideoFile,
  extractFramesFromVideo,
  VideoExtractionError,
  type ExtractionProgress,
} from "@/apps/nextjs-app/utils/video-frame-extractor";
import { importFigmaImages } from "@/apps/nextjs-app/lib/figma/actions";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import type { FigmaFileMetadata } from "@/apps/nextjs-app/types/types";
import type { PluginSessionData } from "@/apps/nextjs-app/lib/auth/plugin-session";
import type { UseFormReturn } from "react-hook-form";

interface UseStudyFileManagementOptions {
  maxFiles: number;
  pluginSession?: PluginSessionData | null;
  /** React Hook Form instance — used to sync files into the form's "files" field */
  form: UseFormReturn<any>;
  /** When true, video files are kept as-is instead of extracting frames */
  skipVideoExtraction?: boolean;
}

export interface StudyFileManagementReturn {
  // File state
  files: File[];
  figmaMetadata: (FigmaFileMetadata | null)[];
  sortDirection: "asc" | "desc";

  // Loading / progress state
  isCardListLoading: boolean;
  videoExtractionProgress: ExtractionProgress | null;

  // Figma state
  figmaConnected: boolean;
  figmaUrl: string;
  figmaLoading: boolean;
  figmaError: string;
  showFigmaFrameWarning: boolean;

  // Figma setters (passed through to FigmaImportSection)
  setFigmaConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setFigmaUrl: React.Dispatch<React.SetStateAction<string>>;

  // Derived
  isInteractionDisabled: boolean;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Handlers
  handleUploadButtonClick: (e: React.MouseEvent) => void;
  handleDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleFileInputChange: (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  handleSortToggle: () => void;
  handleFigmaImport: () => void;
  moveCard: (dragIndex: number, hoverIndex: number) => void;
  handleDeleteButtonClick: (index: number) => void;
}

/**
 * Shared hook encapsulating all file management logic for study forms
 * (cognitive walkthrough & heuristic evaluation).
 *
 * Handles:
 * - File state (add, delete, reorder, sort)
 * - Figma metadata tracking
 * - Drag & drop
 * - Video frame extraction
 * - Plugin session frame loading
 * - Figma OAuth import flow
 * - Form ↔ file state sync
 */
export function useStudyFileManagement({
  pluginSession,
  form,
  skipVideoExtraction = false,
}: UseStudyFileManagementOptions): StudyFileManagementReturn {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File state ──────────────────────────────────────────────────────
  const [files, setFiles] = useState<File[]>([]);
  const [figmaMetadata, setFigmaMetadata] = useState<
    (FigmaFileMetadata | null)[]
  >([]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const hasUserInteractedWithFiles = useRef(false);

  // ── Loading / progress state ────────────────────────────────────────
  const [isCardListLoading, setIsCardListLoading] = useState(false);
  const [videoExtractionProgress, setVideoExtractionProgress] =
    useState<ExtractionProgress | null>(null);

  // ── Figma state ─────────────────────────────────────────────────────
  const [figmaUrl, setFigmaUrl] = useState<string>("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string>("");
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [showFigmaFrameWarning, setShowFigmaFrameWarning] = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────
  const isInteractionDisabled =
    isCardListLoading || figmaLoading || videoExtractionProgress !== null;

  // ── Plugin session frame loading ────────────────────────────────────
  useEffect(() => {
    if (!pluginSession?.frames?.length) return;

    const loadPluginFrames = async () => {
      setIsCardListLoading(true);
      try {
        const framePromises = pluginSession.frames
          .filter((frame) => frame.url)
          .map(async (frame) => {
            const response = await fetch(frame.url!);
            const blob = await response.blob();
            const file = new File([blob], `${frame.name}.png`, {
              type: "image/png",
            });
            const metadata: FigmaFileMetadata = {
              figmaFileKey: "",
              figmaNodeId: frame.nodeId,
              figmaFrameName: frame.name,
              figmaUrl: "",
            };
            return { file, metadata };
          });

        const results = await Promise.allSettled(framePromises);

        const loadedFiles: File[] = [];
        const loadedMetadata: (FigmaFileMetadata | null)[] = [];

        for (const result of results) {
          if (result.status === "fulfilled") {
            loadedFiles.push(result.value.file);
            loadedMetadata.push(result.value.metadata);
          } else {
            clientLogger.warn("Failed to import plugin frame", {
              error: result.reason,
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
  }, [pluginSession]);

  // ── Sync files → form ───────────────────────────────────────────────
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

  // ── Clear card list loading when files arrive ───────────────────────
  useEffect(() => {
    if (isCardListLoading && files.length > 0) {
      setIsCardListLoading(false);
    }
  }, [files, isCardListLoading]);

  // ── Card operations ─────────────────────────────────────────────────
  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setFiles((prevFiles) => {
      return update(prevFiles, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevFiles[dragIndex]],
        ],
      });
    });
    setFigmaMetadata((prevMetadata) => {
      return update(prevMetadata, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, prevMetadata[dragIndex]],
        ],
      });
    });
  }, []);

  const handleDeleteButtonClick = useCallback((index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    setFigmaMetadata((prevMetadata) =>
      prevMetadata.filter((_, i) => i !== index),
    );
  }, []);

  // ── Video processing ────────────────────────────────────────────────
  const processUploadedFiles = useCallback(
    async (inputFiles: File[]): Promise<File[]> => {
      // When skipVideoExtraction is set, return all files as-is
      if (skipVideoExtraction) {
        return inputFiles;
      }

      const imageFiles: File[] = [];
      const videoFiles: File[] = [];

      for (const file of inputFiles) {
        if (isVideoFile(file)) {
          videoFiles.push(file);
        } else {
          imageFiles.push(file);
        }
      }

      if (videoFiles.length === 0) {
        return imageFiles;
      }

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
    [skipVideoExtraction],
  );

  // ── Helper to append processed files + null metadata ────────────────
  const appendFiles = useCallback((processedFiles: File[]) => {
    if (processedFiles.length > 0) {
      setFiles((prev) => [...prev, ...processedFiles]);
      setFigmaMetadata((prev) => [...prev, ...processedFiles.map(() => null)]);
    }
  }, []);

  // ── Upload button ───────────────────────────────────────────────────
  const handleUploadButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isInteractionDisabled || !fileInputRef.current) return;
      fileInputRef.current.click();
    },
    [isInteractionDisabled],
  );

  // ── Drag & drop ────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (isInteractionDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) {
        setIsCardListLoading(false);
        return;
      }
      setIsCardListLoading(true);

      const processedFiles = await processUploadedFiles(droppedFiles);
      appendFiles(processedFiles);

      setIsCardListLoading(false);
    },
    [isInteractionDisabled, processUploadedFiles, appendFiles],
  );

  // ── File input change ──────────────────────────────────────────────
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (isInteractionDisabled) return;

      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) {
        setIsCardListLoading(false);
        return;
      }
      setIsCardListLoading(true);

      const processedFiles = await processUploadedFiles(selectedFiles);
      appendFiles(processedFiles);

      setIsCardListLoading(false);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [isInteractionDisabled, processUploadedFiles, appendFiles],
  );

  // ── Sort ────────────────────────────────────────────────────────────
  const handleSortToggle = useCallback(() => {
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
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }, [files, sortDirection]);

  // ── Figma import ────────────────────────────────────────────────────
  const fetchFigmaImages = useCallback(async (url: string) => {
    try {
      setIsCardListLoading(true);
      setFigmaLoading(true);
      setFigmaError("");
      setShowFigmaFrameWarning(false);

      const result = await importFigmaImages(url);

      if (!result.success) {
        setFigmaError(result.error || "Failed to import from Figma.");
        setIsCardListLoading(false);
        return;
      }

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
        error instanceof Error ? error.message : "Failed to import from Figma.",
      );
      setIsCardListLoading(false);
    } finally {
      setFigmaLoading(false);
    }
  }, []);

  const handleFigmaImport = useCallback(() => {
    if (isInteractionDisabled) return;
    if (!figmaUrl.trim()) {
      setFigmaError("Enter a valid Figma prototype URL.");
      return;
    }
    fetchFigmaImages(figmaUrl);
  }, [isInteractionDisabled, figmaUrl, fetchFigmaImages]);

  return {
    // File state
    files,
    figmaMetadata,
    sortDirection,

    // Loading / progress
    isCardListLoading,
    videoExtractionProgress,

    // Figma state
    figmaConnected,
    figmaUrl,
    figmaLoading,
    figmaError,
    showFigmaFrameWarning,
    setFigmaConnected,
    setFigmaUrl,

    // Derived
    isInteractionDisabled,

    // Refs
    fileInputRef,

    // Handlers
    handleUploadButtonClick,
    handleDrag,
    handleDrop,
    handleFileInputChange,
    handleSortToggle,
    handleFigmaImport,
    moveCard,
    handleDeleteButtonClick,
  };
}
