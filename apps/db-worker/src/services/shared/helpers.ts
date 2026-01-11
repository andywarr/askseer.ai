import { randomBytes } from "crypto";
import { FileType, ImageType, StudyType } from "@prisma/client";

/**
 * Convert MIME type to FileType enum
 */
export function convertToFileType(type: string): FileType {
  switch (type.split("/")[0].toLowerCase()) {
    case "image":
      return FileType.IMAGE;
    default:
      return FileType.UNKNOWN;
  }
}

/**
 * Convert MIME type to ImageType enum
 */
export function convertToImageType(type: string): ImageType {
  switch (type.split("/")[1]?.toLowerCase()) {
    case "apng":
      return ImageType.APNG;
    case "avif":
      return ImageType.AVIF;
    case "gif":
      return ImageType.GIF;
    case "jpeg":
      return ImageType.JPEG;
    case "png":
      return ImageType.PNG;
    case "svg+xml":
      return ImageType.SVG;
    case "webp":
      return ImageType.WEBP;
    default:
      return ImageType.UNKNOWN;
  }
}

/**
 * Guess ImageType from file extension in key
 */
export function guessImageTypeFromKey(key: string): ImageType {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return ImageType.PNG;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ImageType.JPEG;
  if (lower.endsWith(".gif")) return ImageType.GIF;
  if (lower.endsWith(".webp")) return ImageType.WEBP;
  if (lower.endsWith(".avif")) return ImageType.AVIF;
  if (lower.endsWith(".apng")) return ImageType.APNG;
  if (lower.endsWith(".svg")) return ImageType.SVG;
  return ImageType.UNKNOWN;
}

/**
 * Convert string to StudyType enum
 */
export function convertToStudyType(type: string): StudyType | null {
  switch (type.toUpperCase()) {
    case "COGNITIVE_WALKTHROUGH":
      return StudyType.COGNITIVE_WALKTHROUGH;
    case "HEURISTIC_EVALUATION":
      return StudyType.HEURISTIC_EVALUATION;
    case "PERSONA":
      return StudyType.PERSONA;
    case "UNKNOWN":
      return StudyType.UNKNOWN;
    default:
      return null;
  }
}

/**
 * Generate a cryptographically secure random share token for public sharing
 */
export function generateShareToken(): string {
  return randomBytes(12).toString("base64url"); // 16 URL-safe characters
}

/**
 * Normalize reason string to a sortable key for credit ledger
 */
export function normalizeReason(reason: string | null): string {
  if (!reason) return "zzz_unknown"; // Sort nulls last
  const r = reason.toLowerCase();
  if (r.includes("adjustment")) return "adjustment";
  if (r.includes("grant") && r.includes("removed")) return "grant_removed";
  if (r.includes("grant")) return "grant";
  if (r.includes("migration")) return "migration";
  if (r.includes("purchase") || r.includes("stripe")) return "purchase";
  if (r.includes("refund")) return "refund";
  if (r.includes("consume") || r.includes("study")) return "study";
  if (r.includes("transfer")) return "transfer";
  return "zzz_" + reason; // Unknown reasons sort last
}
