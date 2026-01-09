import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";

/**
 * Gets the user profile image URL, prioritizing custom uploaded imageKey over OAuth image.
 * If imageKey exists, fetches a presigned URL from S3.
 * Falls back to the OAuth image URL if no custom image or if presigned URL fetch fails.
 */
export async function getUserImageUrl(
  user: { image?: string | null; imageKey?: string | null } | null,
): Promise<string | null> {
  if (!user) return null;
  if (user.imageKey) {
    try {
      const result = await getPresignedUrls(user.imageKey);
      return result.success && result.data ? result.data : (user.image ?? null);
    } catch {
      return user.image ?? null;
    }
  }
  return user.image ?? null;
}
