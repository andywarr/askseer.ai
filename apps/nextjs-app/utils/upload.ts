/**
 * Upload utilities with retry logic and offline detection.
 * File size validation is handled by Zod schemas in lib/schema.ts
 */

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Check if the browser is currently offline
 */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Custom error class for upload failures
 */
export class UploadError extends Error {
  public readonly isOffline: boolean;
  public readonly isNetworkError: boolean;
  public readonly fileName?: string;
  public readonly retriesAttempted: number;

  constructor(
    message: string,
    options: {
      isOffline?: boolean;
      isNetworkError?: boolean;
      fileName?: string;
      retriesAttempted?: number;
    } = {},
  ) {
    super(message);
    this.name = "UploadError";
    this.isOffline = options.isOffline ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
    this.fileName = options.fileName;
    this.retriesAttempted = options.retriesAttempted ?? 0;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a single file with retry logic
 */
export async function uploadFileWithRetry(
  file: File,
  uploadUrl: string,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<void> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? INITIAL_RETRY_DELAY_MS;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if offline before attempting
    if (isOffline()) {
      throw new UploadError(
        "You appear to be offline. Please check your internet connection and try again.",
        {
          isOffline: true,
          isNetworkError: true,
          fileName: file.name,
          retriesAttempted: attempt,
        },
      );
    }

    try {
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (response.ok) {
        return; // Success!
      }

      // Server returned an error status
      lastError = new Error(
        `Upload failed with status ${response.status}: ${response.statusText}`,
      );
    } catch (error) {
      // Network error (Failed to fetch, etc.)
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we went offline during the request
      if (isOffline()) {
        throw new UploadError(
          "Your internet connection was lost during upload. Please check your connection and try again.",
          {
            isOffline: true,
            isNetworkError: true,
            fileName: file.name,
            retriesAttempted: attempt,
          },
        );
      }
    }

    // If this wasn't the last attempt, wait before retrying
    if (attempt < maxRetries) {
      const delay = initialDelayMs * Math.pow(2, attempt); // Exponential backoff
      options.onRetry?.(attempt + 1, lastError!);
      await sleep(delay);
    }
  }

  // All retries exhausted
  const isNetworkError =
    lastError?.message?.includes("fetch") ||
    lastError?.message?.includes("network") ||
    lastError?.message?.includes("Failed to fetch");

  throw new UploadError(
    isNetworkError
      ? `Failed to upload "${file.name}" after ${maxRetries + 1} attempts. Please check your internet connection and try again.`
      : `Failed to upload "${file.name}": ${lastError?.message || "Unknown error"}`,
    {
      isOffline: false,
      isNetworkError,
      fileName: file.name,
      retriesAttempted: maxRetries + 1,
    },
  );
}

/**
 * Get a user-friendly error message for upload failures
 */
export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof UploadError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Check for common network error patterns
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("network")
    ) {
      if (isOffline()) {
        return "You appear to be offline. Please check your internet connection and try again.";
      }
      return "A network error occurred while uploading. Please check your connection and try again.";
    }

    return error.message;
  }

  return "An unexpected error occurred while uploading. Please try again.";
}
