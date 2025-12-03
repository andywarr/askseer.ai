/**
 * Feature flags configuration
 *
 * These flags allow enabling/disabling features without code changes.
 * Set via environment variables or URL parameters for testing.
 */

/**
 * Enable Figma OAuth integration
 *
 * When enabled:
 * - Users connect their Figma account via OAuth
 * - Figma imports use the user's OAuth token
 * - "Connected Apps" section appears in account settings
 *
 * When disabled:
 * - Uses the shared personal access token (NEXT_PUBLIC_FIGMA_API_TOKEN)
 * - No Figma connection UI shown
 * - Original PAT-based import flow
 *
 * Can be enabled via:
 * 1. Environment variable: NEXT_PUBLIC_FIGMA_OAUTH_ENABLED=true
 * 2. URL parameter: ?figma_oauth=true (for testing)
 */
export const FIGMA_OAUTH_ENABLED =
  process.env.NEXT_PUBLIC_FIGMA_OAUTH_ENABLED === "true";

/**
 * Check if Figma OAuth is enabled, considering URL parameter override
 * Use this in client components to allow URL-based testing
 *
 * @param searchParams - URL search params (from useSearchParams or page props)
 * @returns boolean - whether Figma OAuth should be enabled
 */
export function isFigmaOAuthEnabled(
  searchParams?: URLSearchParams | null,
): boolean {
  // Check URL parameter first (allows testing override)
  if (typeof window !== "undefined" && !searchParams) {
    searchParams = new URLSearchParams(window.location.search);
  }

  if (searchParams) {
    const urlOverride = searchParams.get("figma_oauth");
    if (urlOverride === "true") return true;
    if (urlOverride === "false") return false;
  }

  // Fall back to environment variable
  return FIGMA_OAUTH_ENABLED;
}
