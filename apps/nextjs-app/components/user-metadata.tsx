"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/apps/nextjs-app/components/ui/avatar";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils";
import { User, UserX } from "lucide-react";

interface UserMetadataProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    status?: string | null;
  } | null;
  fallbackName?: string;
  fallbackEmail?: string;
  className?: string;
}

export function UserMetadataDisplay({
  user,
  fallbackName,
  fallbackEmail,
  className,
}: UserMetadataProps) {
  const isDeleted = user?.status === "ERASED";
  const isDeactivated = user?.status === "DEACTIVATED";
  const displayName = isDeleted
    ? "Deleted User"
    : user?.name?.trim() || user?.email || fallbackName || "Unknown member";
  const displayEmail = isDeleted ? undefined : user?.email || fallbackEmail;
  const initials = !isDeleted ? getInitials(displayName)?.trim() : undefined;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className="h-9 w-9 rounded-lg">
        {!isDeleted ? (
          <>
            <AvatarImage
              src={user?.image || undefined}
              alt={displayName}
              className="h-full w-full object-cover"
            />
            <AvatarFallback className="rounded-lg">
              {initials ? (
                initials
              ) : (
                <User className="h-4 w-4" aria-label="User" />
              )}
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="rounded-lg">
            <UserX className="h-4 w-4" aria-label="Deleted user" />
          </AvatarFallback>
        )}
      </Avatar>
      <div
        className={cn(
          "grid min-w-0 flex-1 text-left text-sm leading-tight",
          isDeactivated && "text-muted-foreground",
        )}
      >
        <span className="truncate font-medium">{displayName}</span>
        {displayEmail ? (
          <span className="text-muted-foreground truncate text-xs">
            {displayEmail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
