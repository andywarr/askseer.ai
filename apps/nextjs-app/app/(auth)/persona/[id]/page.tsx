// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { getPersona } from "@/apps/nextjs-app/lib/data";
import { getPresignedUrls as getPresignedUrl } from "@/apps/nextjs-app/lib/action";
import Image from "next/image";

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

  let coverUrl: string | null = null;
  if (coverKey) {
    try {
      coverUrl = await getPresignedUrl(coverKey);
    } catch (e) {
      // If presign fails, gracefully skip showing a cover
      coverUrl = null;
    }
  }

  return (
    <div className="w-full">
      {coverUrl ? (
        <div className="relative h-[25svh] w-full md:h-[25vh]">
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
        </div>
      ) : (
        <div
          className="h-[25svh] w-full bg-gradient-to-r from-zinc-100 to-zinc-200 md:h-[25vh] dark:from-zinc-800 dark:to-zinc-900"
          aria-hidden
        />
      )}

      <div className="container mx-auto px-4 py-6">Persona ID: {id}</div>
    </div>
  );
}
