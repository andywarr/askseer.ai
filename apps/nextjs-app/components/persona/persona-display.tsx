"use client";

import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";

interface PersonaDisplayProps {
  /**
   * The study ID for the persona - used for linking if hasAccess is true
   */
  personaStudyId: string;
  /**
   * Persona display name
   */
  name: string | null;
  /**
   * Persona description
   */
  description: string | null;
  /**
   * URL to the persona's photo (presigned URL)
   */
  photoUrl: string | null;
  /**
   * Whether the current user has access to view this persona
   */
  hasAccess: boolean;
}

/**
 * Returns initials from a name (max 2 characters)
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Displays a persona with avatar, name, and description.
 * If hasAccess is true, it renders as a clickable link to the persona page.
 * If hasAccess is false, it renders with a lock icon and a tooltip explaining
 * the user doesn't have permission to view the persona.
 */
export function PersonaDisplay({
  personaStudyId,
  name,
  description,
  photoUrl,
  hasAccess,
}: PersonaDisplayProps) {
  const initials = getInitials(name);
  const displayName = name ?? "Unnamed persona";
  const displayDescription = description ?? "No description";

  const content = (
    <div className="mt-1 flex items-center gap-3">
      <Avatar className="h-10 w-10">
        {photoUrl ? (
          <AvatarImage src={photoUrl} alt={displayName} />
        ) : (
          <AvatarFallback>{initials}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate leading-5 font-medium">
          {displayName}
        </span>
        <span className="truncate leading-5 text-zinc-600">
          {displayDescription}
        </span>
      </div>
    </div>
  );

  if (hasAccess) {
    return (
      <Link href={`/persona/${personaStudyId}`} className="hover:opacity-90">
        {content}
      </Link>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-not-allowed">{content}</div>
      </TooltipTrigger>
      <TooltipContent>
        <p>You don&apos;t have permission to view this persona</p>
      </TooltipContent>
    </Tooltip>
  );
}
