// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { getPersona } from "@/apps/nextjs-app/lib/data";
import { getPresignedUrls as getPresignedUrl } from "@/apps/nextjs-app/lib/action";
import Image from "next/image";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";
import {
  Calendar,
  User as UserIcon,
  MapPin,
  GraduationCap,
  Banknote,
  Heart,
  Users,
} from "lucide-react";
import type { Persona } from "@/apps/shared/jobSchema";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const study = await getPersona(id, session.userId);

  const persona: Persona | undefined =
    (study?.persona.data.data as Persona | undefined) || undefined;

  if (!persona) {
    throw new Error("Persona not found");
  }

  const name = persona?.name || undefined;

  const coverKey: string | undefined = persona.images?.coverKey || undefined;
  const photoKey: string | undefined = persona.images?.photoKey || undefined;

  let coverUrl: string | null = null;
  if (coverKey) {
    try {
      coverUrl = await getPresignedUrl(coverKey);
    } catch (e) {
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
            alt={name ? `${name} profile photo` : "Persona profile photo"}
            width={256}
            height={256}
            className="h-full w-full object-cover"
            sizes="(max-width: 768px) 7rem, 8rem"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200">
            <span className="text-xl font-semibold">
              {(name || "?")
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
            <MoreMenu
              surface="PERSONA"
              userId={session.userId}
              study={study}
              s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
            />
          </div>
          <Image
            src={coverUrl}
            alt={name ? `${name} cover` : "Persona cover image"}
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
            <MoreMenu
              surface="PERSONA"
              userId={session.userId}
              study={study}
              s3Keys={[coverKey, photoKey].filter(Boolean) as string[]}
            />
          </div>
          {avatarOverlay}
        </div>
      )}
      <div className="container mx-auto px-4">
        <section
          className="pb-6 pl-40 md:pl-48"
          aria-labelledby="persona-title"
        >
          <h1
            id="persona-title"
            className="scroll-m-20 text-3xl font-semibold tracking-tight"
          >
            {name || "Untitled"}
          </h1>
          {persona.description ? (
            <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
              {persona.description}
            </p>
          ) : null}
        </section>

        {(() => {
          const demographics = persona.demographics || {};
          const items = [
            { label: "Age", value: demographics.age, Icon: Calendar },
            { label: "Gender", value: demographics.gender, Icon: UserIcon },
            { label: "Location", value: demographics.location, Icon: MapPin },
            {
              label: "Education",
              value: demographics.education,
              Icon: GraduationCap,
            },
            { label: "Income", value: demographics.income, Icon: Banknote },
            {
              label: "Marital status",
              value: demographics.maritalStatus,
              Icon: Heart,
            },
            {
              label: "Household size",
              value: demographics.householdSize,
              Icon: Users,
            },
          ].filter(
            (i) => typeof i.value === "string" && i.value.trim().length > 0,
          );

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-40 md:pl-48"
              aria-labelledby="persona-demographics"
            >
              <h2
                id="persona-demographics"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Demographics
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    aria-label={`${label}: ${value}`}
                  >
                    <Icon
                      className="text-muted-foreground h-4 w-4"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs">
                        {label}
                      </div>
                      <div className="truncate leading-6 font-medium">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}
