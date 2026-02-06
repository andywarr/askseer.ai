import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";

/**
 * Fetches a presigned URL for a given S3 object key.
 * Used by PersonaSelect to display persona images.
 */
export async function getPersonaImageUrl(key: string): Promise<string> {
  try {
    const result = await getPresignedUrls(key);
    return result.success && result.data ? result.data : "";
  } catch {
    return "";
  }
}
