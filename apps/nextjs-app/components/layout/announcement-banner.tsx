"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import Link from "next/link";

interface AnnouncementBannerProps {
  message?: string;
  link?: string;
  linkText?: string;
  dismissible?: boolean;
  variant?: "warning" | "destructive" | "info";
}

function getBannerKey(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return `announcement_banner_dismissed_${Math.abs(hash)}`;
}

export function AnnouncementBanner({
  message = process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER,
  link = process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_LINK,
  linkText = process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_LINK_TEXT,
  dismissible = process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_DISMISSIBLE !== "false",
  variant = (process.env.NEXT_PUBLIC_ANNOUNCEMENT_BANNER_VARIANT as
    | "warning"
    | "destructive"
    | "info") || "warning",
}: AnnouncementBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!message || !dismissible) return;
    try {
      const storageKey = getBannerKey(message);
      if (sessionStorage.getItem(storageKey) === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Handle private browsing or restricted environments safely
    }
  }, [message, dismissible]);

  if (!message || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      const storageKey = getBannerKey(message);
      sessionStorage.setItem(storageKey, "true");
    } catch {
      // Ignore storage errors
    }
    setIsDismissed(true);
  };

  const isExternalLink =
    link?.startsWith("http://") || link?.startsWith("https://");

  const variantStyles = {
    warning: {
      container:
        "border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-200",
      icon: "text-amber-600 dark:text-amber-400",
      link: "text-amber-950 hover:text-amber-800 dark:text-amber-100 dark:hover:text-amber-50",
      button:
        "text-amber-800 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-900/60 focus:ring-amber-500",
      IconComponent: AlertTriangle,
    },
    destructive: {
      container:
        "border-b border-red-300 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-200",
      icon: "text-red-600 dark:text-red-400",
      link: "text-red-950 hover:text-red-800 dark:text-red-100 dark:hover:text-red-50",
      button:
        "text-red-800 hover:bg-red-200/60 dark:text-red-300 dark:hover:bg-red-900/60 focus:ring-red-500",
      IconComponent: AlertTriangle,
    },
    info: {
      container:
        "border-b border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/80 dark:text-blue-200",
      icon: "text-blue-600 dark:text-blue-400",
      link: "text-blue-950 hover:text-blue-800 dark:text-blue-100 dark:hover:text-blue-50",
      button:
        "text-blue-800 hover:bg-blue-200/60 dark:text-blue-300 dark:hover:bg-blue-900/60 focus:ring-blue-500",
      IconComponent: Info,
    },
  }[variant] || {
    container:
      "border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
    link: "text-amber-950 hover:text-amber-800 dark:text-amber-100 dark:hover:text-amber-50",
    button:
      "text-amber-800 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-900/60 focus:ring-amber-500",
    IconComponent: AlertTriangle,
  };

  const { IconComponent } = variantStyles;

  return (
    <aside
      role="region"
      aria-label="Announcement"
      className={`relative isolate flex items-center justify-between gap-x-3 px-4 py-2.5 text-xs sm:text-sm print:hidden ${variantStyles.container}`}
    >
      <div className="flex flex-1 items-center justify-center gap-2 text-center font-medium leading-relaxed">
        <IconComponent className={`h-4 w-4 shrink-0 ${variantStyles.icon}`} />
        <span>{message}</span>
        {link &&
          (isExternalLink ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-1 inline-flex items-center font-semibold underline underline-offset-4 ${variantStyles.link}`}
            >
              {linkText || "Learn more"}
            </a>
          ) : (
            <Link
              href={link}
              className={`ml-1 inline-flex items-center font-semibold underline underline-offset-4 ${variantStyles.link}`}
            >
              {linkText || "Learn more"}
            </Link>
          ))}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={`shrink-0 rounded-md p-1 transition-colors focus:outline-none focus:ring-2 ${variantStyles.button}`}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </aside>
  );
}
