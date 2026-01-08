/**
 * Format seconds into a human-readable time string with appropriate units
 */
export function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else if (seconds < 86400) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else {
    const days = Math.ceil(seconds / 86400);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}

/**
 * Build a rate limit error message with optional retry time
 */
export function buildFigmaRateLimitError(
  retryAfterHeader: string | null,
): string {
  const baseMessage = "Figma API rate limit exceeded.";
  const upgradeHint =
    "Consider upgrading your Figma plan for higher rate limits.";

  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return `${baseMessage} Please wait ${formatRetryTime(seconds)} and try again. ${upgradeHint}`;
    }
  }

  return `${baseMessage} Please wait a few minutes and try again. ${upgradeHint}`;
}
