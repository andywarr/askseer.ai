// @ts-nocheck

/**
 * Re-export all server actions from their respective modules.
 * This file maintains backward compatibility for existing imports.
 *
 * For new code, prefer importing directly from the specific action modules:
 * - lib/actions/shared.ts - Types, utilities (ActionResult, requireAuth, etc.)
 * - lib/actions/s3-actions.ts - S3/presigned URL operations
 * - lib/actions/email-actions.ts - Contact forms and email alerts
 * - lib/actions/team-actions.ts - Team management
 * - lib/actions/auth-actions.ts - Authentication (sign out)
 * - lib/actions/persona-actions.ts - Persona CRUD
 * - lib/actions/study-lifecycle-actions.ts - Study init, finalize, retry
 * - lib/actions/study-actions.ts - Study visibility and sharing
 */

// ==========================================
// Shared Types & Utilities
// ==========================================
export type {
  ActionResult,
  ValidationResult,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// Auth Actions
// ==========================================
export { signOutServerAction } from "@/apps/nextjs-app/lib/actions/auth-actions";

// ==========================================
// Team Actions
// ==========================================
export { updateSelectedTeamAction } from "@/apps/nextjs-app/lib/actions/team-actions";

// ==========================================
// S3 Actions
// ==========================================
export {
  getProfileImagePutUrl,
  getCompanyLogoPutUrl,
  getPresignedUrls,
  getPublicPresignedUrl,
  getCompanyLogoGetUrl,
  deleteS3Objects,
} from "@/apps/nextjs-app/lib/actions/s3-actions";

// ==========================================
// Email Actions
// ==========================================
export {
  submitDemoRequest,
  submitContactRequest,
} from "@/apps/nextjs-app/lib/actions/email-actions";

// ==========================================
// Persona Actions
// ==========================================
export {
  listMyPersonas,
  createPersona,
  updatePersona,
} from "@/apps/nextjs-app/lib/actions/persona-actions";

// ==========================================
// Study Lifecycle Actions
// ==========================================
export {
  initStudy,
  getStudyUploadUrls,
  putPresignedUrls,
  finalizeStudy,
  cleanupOrphanedStudy,
  retryStudy,
  listMyHeuristicFamilies,
  finalizeAndQueueStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
