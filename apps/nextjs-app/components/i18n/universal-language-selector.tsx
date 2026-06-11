"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Globe, Search, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import { SidebarMenuButton } from "@/apps/nextjs-app/components/ui/sidebar";
import localesConfig from "@/apps/nextjs-app/i18n/locales.json";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface UniversalLanguageSelectorProps {
  onBeforeChange?: () => void;
  className?: string;
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "sidebar";
  triggerSize?: "default" | "sm" | "lg" | "icon";
}

export function UniversalLanguageSelector({
  onBeforeChange,
  className,
  triggerVariant = "outline",
  triggerSize = "default",
}: UniversalLanguageSelectorProps) {
  const t = useTranslations("AccountSettings");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  // Reset search when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // Dynamic mapping of locale codes to display labels
  const languages = React.useMemo(() => {
    const items = localesConfig.locales.map((loc) => {
      const hasTranslation = t.has(`language.${loc}`);
      const label = hasTranslation
        ? t(`language.${loc}`)
        : ((localesConfig.labels as Record<string, string>)[loc] || loc.toUpperCase());
      return { code: loc, label };
    });
    // Sort alphabetically by label based on current locale
    return [...items].sort((a, b) => a.label.localeCompare(b.label, currentLocale));
  }, [t, currentLocale]);

  const filteredLanguages = React.useMemo(() => {
    return languages.filter((lang) =>
      lang.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [languages, searchQuery]);

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === currentLocale) {
      setOpen(false);
      return;
    }

    if (onBeforeChange) {
      onBeforeChange();
    }

    // Persist the chosen locale in the standard next-intl cookie
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

    startTransition(() => {
      const segments = pathname.split("/");

      // If the current path has a supported non-default locale prefix, remove it.
      if (localesConfig.locales.includes(segments[1]) && segments[1] !== localesConfig.defaultLocale) {
        segments.splice(1, 1);
      }

      const cleanedPath = segments.join("/") || "/";

      // next-intl pattern: defaultLocale has no prefix, other locales prefix the path
      const nextPath =
        nextLocale === localesConfig.defaultLocale
          ? cleanedPath
          : cleanedPath === "/"
          ? `/${nextLocale}`
          : `/${nextLocale}${cleanedPath}`;

      setOpen(false);
      router.push(nextPath);
    });
  };

  // Find current language display label
  const currentLangLabel = React.useMemo(() => {
    const active = languages.find((lang) => lang.code === currentLocale);
    return active ? active.label : (localesConfig.labels as Record<string, string>)[currentLocale] || currentLocale.toUpperCase();
  }, [languages, currentLocale]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "sidebar" ? (
          <SidebarMenuButton
            className={cn("cursor-pointer", className)}
            disabled={isPending}
            asChild
          >
            <button type="button">
              <Globe className="h-4 w-4 shrink-0" />
              <span>{currentLangLabel}</span>
            </button>
          </SidebarMenuButton>
        ) : (
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={cn("gap-2 font-normal", className)}
            disabled={isPending}
          >
            <Globe className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span>{currentLangLabel}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("language.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="relative my-2">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <Input
            type="text"
            placeholder={t("language.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-700 bg-transparent text-sm text-zinc-900 dark:text-zinc-50"
            autoFocus
          />
        </div>
        <ScrollArea className="mt-2 h-[150px] pr-1">
          <div className="space-y-1">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => {
                const isActive = lang.code === currentLocale;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLocaleChange(lang.code)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-left transition-colors cursor-pointer border-0 bg-transparent outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800",
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
                    )}
                  >
                    <span>{lang.label}</span>
                    {isActive && <Check className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t("language.noLanguagesFound")}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
