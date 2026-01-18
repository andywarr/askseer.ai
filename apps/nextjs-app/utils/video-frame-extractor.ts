/**
 * Video Frame Extraction Utility
 *
 * Extracts distinct key frames from a video file using client-side processing.
 * Uses canvas-based frame comparison to filter out similar/duplicate frames.
 */

// Configuration constants (hardcoded as per requirements)
const EXTRACTION_INTERVAL_SECONDS = 0.5; // Extract 2 frames per second to catch transient UI (menus, tooltips)
const SIMILARITY_THRESHOLD = 0.99; // 99% similarity = duplicate (high threshold keeps frames with small UI changes like menus)
const MAX_VIDEO_DURATION_SECONDS = 600; // 10 minutes
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

// Dual-resolution extraction:
// - COMPARISON_WIDTH: Lower resolution for fast deduplication comparison
// - MAX_EXPORT_WIDTH: High resolution for exported frames (AI analysis needs detail)
// This ensures AI gets high-quality images while keeping dedup fast
const COMPARISON_WIDTH = 640; // Lower resolution for frame comparison (faster dedup)
const MAX_EXPORT_WIDTH = 3840; // Max export width for AI analysis (keeps original if smaller)
const COMPARISON_SAMPLE_SIZE = 10000; // Number of pixels to sample for comparison

export interface ExtractionProgress {
  phase: "loading" | "extracting" | "deduplicating" | "complete";
  current: number;
  total: number;
  message: string;
}

export interface ExtractionResult {
  frames: File[];
  totalExtracted: number;
  totalAfterDedup: number;
  videoDuration: number;
}

export class VideoExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_TYPE"
      | "FILE_TOO_LARGE"
      | "VIDEO_TOO_LONG"
      | "LOAD_FAILED"
      | "EXTRACTION_FAILED",
  ) {
    super(message);
    this.name = "VideoExtractionError";
  }
}

const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
  "video/x-m4v",
];

/**
 * Check if a file is a supported video type
 */
export function isVideoFile(file: File): boolean {
  return SUPPORTED_VIDEO_TYPES.includes(file.type);
}

/**
 * Get supported video MIME types
 */
export function getSupportedVideoTypes(): string[] {
  return [...SUPPORTED_VIDEO_TYPES];
}

/**
 * Validate a video file before extraction
 */
export function validateVideoFile(file: File): void {
  if (!isVideoFile(file)) {
    throw new VideoExtractionError(
      `Unsupported video format. Please use MP4, WebM, or MOV.`,
      "INVALID_TYPE",
    );
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new VideoExtractionError(
      `Video file is too large. Maximum size is ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB.`,
      "FILE_TOO_LARGE",
    );
  }
}

/**
 * Extract distinct key frames from a video file
 */
export async function extractFramesFromVideo(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ExtractionResult> {
  // Validate the file first
  validateVideoFile(file);

  const reportProgress = (progress: ExtractionProgress) => {
    onProgress?.(progress);
  };

  reportProgress({
    phase: "loading",
    current: 0,
    total: 100,
    message: "Loading video...",
  });

  // Create video element and load the file
  const video = document.createElement("video");
  const videoUrl = URL.createObjectURL(file);

  try {
    // Load video metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(
          new VideoExtractionError(
            "Failed to load video. The file may be corrupted or use an unsupported codec.",
            "LOAD_FAILED",
          ),
        );
      video.src = videoUrl;
      video.load();
    });

    const duration = video.duration;

    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new VideoExtractionError(
        `Video is too long. Maximum duration is ${MAX_VIDEO_DURATION_SECONDS / 60} minutes.`,
        "VIDEO_TOO_LONG",
      );
    }

    // Calculate total frames to extract
    const totalFrames = Math.ceil(duration / EXTRACTION_INTERVAL_SECONDS);

    reportProgress({
      phase: "extracting",
      current: 0,
      total: totalFrames,
      message: `Extracting frames from ${Math.round(duration)}s video...`,
    });

    // Set up two canvases: one for comparison (low res), one for export (high res)
    // This allows fast deduplication while preserving quality for AI analysis
    const comparisonCanvas = document.createElement("canvas");
    const exportCanvas = document.createElement("canvas");
    const comparisonCtx = comparisonCanvas.getContext("2d", { willReadFrequently: true });
    const exportCtx = exportCanvas.getContext("2d");

    if (!comparisonCtx || !exportCtx) {
      throw new VideoExtractionError(
        "Failed to initialize canvas for frame extraction.",
        "EXTRACTION_FAILED",
      );
    }

    // Calculate dimensions maintaining aspect ratio
    const aspectRatio = video.videoWidth / video.videoHeight;

    // Low-res dimensions for comparison (fast dedup)
    const comparisonWidth = Math.min(COMPARISON_WIDTH, video.videoWidth);
    const comparisonHeight = Math.round(comparisonWidth / aspectRatio);
    comparisonCanvas.width = comparisonWidth;
    comparisonCanvas.height = comparisonHeight;

    // High-res dimensions for export (AI analysis needs detail)
    const exportWidth = Math.min(MAX_EXPORT_WIDTH, video.videoWidth);
    const exportHeight = Math.round(exportWidth / aspectRatio);
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    // Extract frames at intervals
    const extractedFrames: { exportBlob: Blob; comparisonData: ImageData }[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * EXTRACTION_INTERVAL_SECONDS;

      // Seek to timestamp
      await seekToTime(video, timestamp);

      // Draw frame to both canvases
      comparisonCtx.drawImage(video, 0, 0, comparisonWidth, comparisonHeight);
      exportCtx.drawImage(video, 0, 0, exportWidth, exportHeight);

      // Get image data from comparison canvas for dedup
      const comparisonData = comparisonCtx.getImageData(0, 0, comparisonWidth, comparisonHeight);

      // Convert export canvas to blob (high quality for AI)
      const exportBlob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob from canvas"));
          },
          "image/png",
          1.0, // Maximum quality for export
        );
      });

      extractedFrames.push({ exportBlob, comparisonData });

      reportProgress({
        phase: "extracting",
        current: i + 1,
        total: totalFrames,
        message: `Extracted frame ${i + 1} of ${totalFrames}...`,
      });
    }

    // Deduplicate frames
    reportProgress({
      phase: "deduplicating",
      current: 0,
      total: extractedFrames.length,
      message: "Removing duplicate frames...",
    });

    const uniqueFrames = deduplicateFrames(
      extractedFrames,
      (current, total) => {
        reportProgress({
          phase: "deduplicating",
          current,
          total,
          message: `Comparing frame ${current} of ${total}...`,
        });
      },
    );

    // Convert blobs to Files with sequential names
    const videoBaseName = file.name.replace(/\.[^/.]+$/, "");
    const files = uniqueFrames.map((frame, index) => {
      const paddedIndex = String(index + 1).padStart(3, "0");
      const fileName = `${videoBaseName}_frame_${paddedIndex}.png`;
      return new File([frame.exportBlob], fileName, { type: "image/png" });
    });

    reportProgress({
      phase: "complete",
      current: files.length,
      total: files.length,
      message: `Extracted ${files.length} distinct frames`,
    });

    return {
      frames: files,
      totalExtracted: extractedFrames.length,
      totalAfterDedup: files.length,
      videoDuration: duration,
    };
  } finally {
    // Clean up
    URL.revokeObjectURL(videoUrl);
    video.remove();
  }
}

/**
 * Seek video to a specific timestamp and wait for it to be ready
 */
function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Seek to ${time}s timed out`));
    }, 5000);

    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };

    const onError = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error(`Failed to seek to ${time}s`));
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

/**
 * Remove duplicate/similar frames based on pixel comparison
 * Uses low-res comparisonData for fast dedup, preserves high-res exportBlob for output
 */
function deduplicateFrames(
  frames: { exportBlob: Blob; comparisonData: ImageData }[],
  onProgress?: (current: number, total: number) => void,
): { exportBlob: Blob; comparisonData: ImageData }[] {
  if (frames.length <= 1) return frames;

  const uniqueFrames: { exportBlob: Blob; comparisonData: ImageData }[] = [frames[0]];

  for (let i = 1; i < frames.length; i++) {
    onProgress?.(i, frames.length);

    const currentFrame = frames[i];
    const previousFrame = uniqueFrames[uniqueFrames.length - 1];

    const similarity = calculateSimilarity(
      currentFrame.comparisonData,
      previousFrame.comparisonData,
    );

    // If frames are different enough, keep the new frame
    if (similarity < SIMILARITY_THRESHOLD) {
      uniqueFrames.push(currentFrame);
    }
  }

  return uniqueFrames;
}

/**
 * Calculate similarity between two frames using sampled pixel comparison
 */
function calculateSimilarity(img1: ImageData, img2: ImageData): number {
  const data1 = img1.data;
  const data2 = img2.data;

  if (data1.length !== data2.length) return 0;

  const totalPixels = data1.length / 4; // RGBA = 4 values per pixel
  const sampleStep = Math.max(
    1,
    Math.floor(totalPixels / COMPARISON_SAMPLE_SIZE),
  );

  let matchingPixels = 0;
  let sampledPixels = 0;

  for (let i = 0; i < data1.length; i += 4 * sampleStep) {
    sampledPixels++;

    // Compare RGB values (ignore alpha)
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

    // Consider pixels matching if color difference is small
    // Threshold of 30 allows for minor compression artifacts
    if (rDiff < 30 && gDiff < 30 && bDiff < 30) {
      matchingPixels++;
    }
  }

  return matchingPixels / sampledPixels;
}

/**
 * Get the maximum allowed video duration in seconds
 */
export function getMaxVideoDuration(): number {
  return MAX_VIDEO_DURATION_SECONDS;
}

/**
 * Get the maximum allowed video file size in bytes
 */
export function getMaxVideoSize(): number {
  return MAX_VIDEO_SIZE_BYTES;
}
