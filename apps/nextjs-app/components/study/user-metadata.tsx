"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/apps/nextjs-app/components/ui/avatar";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils/utils";
import { User, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

interface UserMetadataProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    status?: string | null;
  } | null;
  className?: string;
}

export function UserMetadataDisplay({
  user,
  className,
}: UserMetadataProps) {
  const t = useTranslations("UserMetadata");
  const isDeleted = user?.status === "ERASED";
  const isDeactivated = user?.status === "DEACTIVATED";
  const name = user?.name?.trim();
  const email = user?.email?.trim();
  const displayName = isDeleted ? t("deletedUser") : name;
  const displayEmail = isDeleted ? undefined : email;
  const initials = !isDeleted
    ? getInitials(displayName || displayEmail || "")?.trim()
    : undefined;
  const avatarAlt = displayName || displayEmail || t("user");

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className="h-9 w-9 rounded-lg">
        {!isDeleted ? (
          <>
            <AvatarImage
              src={user?.image || undefined}
              alt={avatarAlt}
              className="h-full w-full object-cover"
            />
            <AvatarFallback className="rounded-lg bg-zinc-200 dark:bg-zinc-700">
              {initials ? (
                initials
              ) : (
                <User className="h-4 w-4" aria-label={t("user")} />
              )}
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="rounded-lg bg-zinc-200 dark:bg-zinc-700">
            <UserX className="h-4 w-4" aria-label={t("deletedUser")} />
          </AvatarFallback>
        )}
      </Avatar>
      <div
        className={cn(
          "grid min-w-0 flex-1 text-left text-sm leading-tight",
          isDeactivated && "text-muted-foreground",
        )}
      >
        {displayName ? (
          <span className="truncate font-medium">{displayName}</span>
        ) : null}
        {displayEmail ? (
          <span className="text-muted-foreground truncate text-xs">
            {displayEmail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
