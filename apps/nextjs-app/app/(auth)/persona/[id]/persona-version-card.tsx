// Next imports
import Link from "next/link";
import Image from "next/image";

// UI component imports
import {
  Card,
  CardContent,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

// Lib imports
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

type PersonaVersion = {
  id: string;
  version: number;
  isLatest: boolean;
  study: {
    id: string;
    name: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdByUser: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
  name: string | null;
  description: string | null;
  photoFile?: {
    key: string | null;
  } | null;
  coverFile?: {
    key: string | null;
  } | null;
};

type PersonaVersionCardProps = {
  version: PersonaVersion;
  currentUserId: string;
  photoUrl?: string | null;
  isCurrentVersion?: boolean;
  className?: string;
  imageClassName?: string;
};

export function PersonaVersionCard({
  version,
  currentUserId,
  photoUrl,
  isCurrentVersion = false,
  className,
  imageClassName,
}: PersonaVersionCardProps) {
  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const updatedAtFormatted = formatDateTime(version.study.updatedAt);

  return (
    <Link href={`/persona/${version.study.id}`}>
      <Card
        className={cn(
          "w-full gap-3 overflow-hidden pt-0 pb-6 transition-all hover:border-zinc-400 dark:hover:border-zinc-600",
          className,
        )}
      >
        <CardHeader className={cn("relative h-40", imageClassName)}>
          {photoUrl ? (
            <Image
              className="object-cover"
              src={photoUrl}
              fill
              alt={`${version.name || "Persona"} version ${version.version}`}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200">
              <span className="text-2xl font-semibold">
                {(version.name || "?")
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w: string) => w.charAt(0).toUpperCase())
                  .join("") || "?"}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex min-h-[20px] items-center justify-between gap-2">
              <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
                Version {version.version}
              </small>
              <div className="flex gap-1">
                {version.isLatest && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                  >
                    Latest
                  </Badge>
                )}
                {isCurrentVersion && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  >
                    Viewing
                  </Badge>
                )}
              </div>
            </div>
            <h3 className="line-clamp-2 scroll-m-20 text-xl font-semibold tracking-tight">
              {version.name || "Untitled"}
            </h3>
            <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-sm">
              {version.description || "\u00A0"}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Updated {updatedAtFormatted}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
