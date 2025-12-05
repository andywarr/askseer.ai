/**
 * Feature flags configuration
 *
 * These flags allow enabling/disabling features without code changes.
 * Set via environment variables or URL parameters for testing.
 */

/**
 * Figma OAuth is always enabled.
 * Users must connect their Figma account via OAuth to import Figma files.
 * The "Connected Apps" section appears in account settings.
 *
 * @deprecated This is always true now. OAuth is the default experience.
 */
export const FIGMA_OAUTH_ENABLED = true;

/**
 * Figma OAuth is always enabled.
 *
 * @deprecated This always returns true now. OAuth is the default experience.
 * @param _searchParams - Unused, kept for backwards compatibility
 * @returns boolean - always returns true
 */
export function isFigmaOAuthEnabled(
  _searchParams?: URLSearchParams | null,
): boolean {
  return true;
}
