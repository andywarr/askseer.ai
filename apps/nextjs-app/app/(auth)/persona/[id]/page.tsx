// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { getPersona } from "@/apps/nextjs-app/lib/data";
import { getPresignedUrls as getPresignedUrl } from "@/apps/nextjs-app/lib/action";
import Image from "next/image";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const persona = await getPersona(id, session.userId);

  // Try to extract a cover key from possible shapes
  const coverKey: string | undefined =
    persona?.images?.coverKey ||
    persona?.coverKey ||
    persona?.persona?.images?.coverKey;

  // Try to extract a profile photo key
  const photoKey: string | undefined =
    persona?.images?.photoKey ||
    persona?.photoKey ||
    persona?.persona?.images?.photoKey;

  let coverUrl: string | null = null;
  if (coverKey) {
    try {
      coverUrl = await getPresignedUrl(coverKey);
    } catch (e) {
      // If presign fails, gracefully skip showing a cover
      coverUrl = null;
    }
  }

  let photoUrl: string | null = null;
  if (photoKey) {
    try {
      photoUrl = await getPresignedUrl(photoKey);
    } catch (e) {
      photoUrl = null;
    }
  }

  // Reusable avatar overlay (half over cover, half below)
  const avatarOverlay = (
    <div className="pointer-events-none absolute top-full left-6 z-10 -translate-y-1/2 md:left-8">
      <div className="pointer-events-auto h-28 w-28 overflow-hidden rounded-2xl shadow ring-2 ring-white md:h-32 md:w-32 dark:ring-zinc-900">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={
              persona?.name
                ? `${persona.name} profile photo`
                : "Persona profile photo"
            }
            width={256}
            height={256}
            className="h-full w-full object-cover"
            sizes="(max-width: 768px) 7rem, 8rem"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200">
            <span className="text-xl font-semibold">
              {(persona?.name || "?")
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((w: string) => w.charAt(0).toUpperCase())
                .join("") || "?"}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {coverUrl ? (
        <div className="relative mb-14 h-[25svh] w-full md:mb-16 md:h-[25vh]">
          <div className="absolute top-4 right-4 z-20">
            <MoreMenu surface="PERSONA" />
          </div>
          <Image
            src={coverUrl}
            alt={
              persona?.name ? `${persona.name} cover` : "Persona cover image"
            }
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {avatarOverlay}
        </div>
      ) : (
        <div className="relative mb-14 h-[25svh] w-full bg-gradient-to-r from-zinc-100 to-zinc-200 md:mb-16 md:h-[25vh] dark:from-zinc-800 dark:to-zinc-900">
          <div className="absolute top-4 right-4 z-20">
            <MoreMenu surface="PERSONA" />
          </div>
          {avatarOverlay}
        </div>
      )}

      <div className="container mx-auto px-4 py-6">Persona ID: {id}</div>
    </div>
  );
}
