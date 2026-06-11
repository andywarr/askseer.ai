"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { translateText } from "@/apps/nextjs-app/lib/actions/translate-actions";
import { useTranslationContext } from "./translation-context";
import { toast } from "sonner";

function TranslatingIndicator({ label, inline }: { label: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={`${inline ? "mt-1" : "mt-2"} flex items-center gap-1.5 text-xs text-zinc-400 select-none`}>
      <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
      <span>{label}</span>
    </Tag>
  );
}

function TranslatedBadge({ label, onShowOriginal, showOriginalLabel, inline }: { label: string; onShowOriginal: () => void; showOriginalLabel: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={`${inline ? "mt-1" : "mt-2"} flex items-center gap-2 text-xs text-zinc-400 select-none print:hidden`}>
      <span className="flex items-center gap-1">
        <Globe className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
        {label}
      </span>
      <span>•</span>
      <button
        onClick={onShowOriginal}
        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      >
        {showOriginalLabel}
      </button>
    </Tag>
  );
}

function TranslateButton({ onClick, label, inline }: { onClick: () => void; label: string; inline?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`${inline ? "mt-1" : "mt-2"} flex w-fit items-center gap-1 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 print:hidden`}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

const clientTranslationCache = typeof window !== "undefined" ? new Map<string, string>() : null;

export function getCachedTranslation(key: string): string | null {
  const mem = clientTranslationCache?.get(key);
  if (mem) return mem;

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(`tcache:${key}`);
      if (stored) {
        clientTranslationCache?.set(key, stored);
        return stored;
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
  return null;
}

export function setCachedTranslation(key: string, value: string) {
  clientTranslationCache?.set(key, value);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`tcache:${key}`, value);
    } catch (e) {
      // Ignore storage errors
    }
  }
}

export function clearTranslationCache() {
  clientTranslationCache?.clear();
  if (typeof window !== "undefined") {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("tcache:")) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
}

interface TranslationWrapperProps {
  text: string;
  sourceLocale?: string;
  inline?: boolean;
  children?: (text: string, loading?: boolean) => React.ReactNode;
}

export function TranslationWrapper({
  text,
  sourceLocale = "en",
  inline = false,
  children,
}: TranslationWrapperProps) {
  const context = useTranslationContext();
  const activeLocale = useLocale();
  const t = useTranslations("Translation");

  const cacheKey = `${activeLocale}:${text}`;
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [loading, setLoading] = useState(false);

  const hasLocaleMismatch = sourceLocale !== activeLocale;

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Sync state with cache value on mount or when cacheKey changes
  useEffect(() => {
    const cached = getCachedTranslation(cacheKey);
    setTranslatedText(cached);
    if (!cached) {
      setShowOriginal(true);
    }
  }, [cacheKey]);

  const handleTranslate = useCallback(async () => {
    const cached = getCachedTranslation(cacheKey);
    if (cached) {
      setTranslatedText(cached);
      setShowOriginal(false);
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const result = await translateText(text, activeLocale);
      if (!isMountedRef.current) return;
      if (result.success) {
        const translated = result.data?.translatedText || text;
        setCachedTranslation(cacheKey, translated);
        setTranslatedText(translated);
        setShowOriginal(false);
      } else {
        toast.error(result.error || "Failed to translate text");
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast.error("Failed to translate text");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [text, activeLocale, cacheKey]);

  // Synchronize with global translation context if present
  useEffect(() => {
    if (context) {
      if (context.isGlobalTranslated && hasLocaleMismatch) {
        if (!translatedText && !loading) {
          handleTranslate();
        } else if (translatedText) {
          setShowOriginal(false);
        }
      } else {
        setShowOriginal(true);
      }
    }
  }, [context?.isGlobalTranslated, hasLocaleMismatch, translatedText, loading, handleTranslate]);

  if (!text) return null;

  // If no locale mismatch, just render the text normally
  if (!hasLocaleMismatch) {
    if (children) {
      return <>{children(text, false)}</>;
    }
    return inline ? (
      <span className="whitespace-pre-wrap">{text}</span>
    ) : (
      <p className="whitespace-pre-wrap">{text}</p>
    );
  }

  const displayText = showOriginal ? text : (translatedText || text);

  if (children) {
    return (
      <div className="flex flex-col w-full">
        {children(displayText, loading)}
        {loading && (
          <TranslatingIndicator label={t("translating")} />
        )}
        {!loading && !context && showOriginal && (
          <TranslateButton
            onClick={handleTranslate}
            label={t("translateTo", { language: t(`languages.${activeLocale}`) })}
          />
        )}
        {!loading && !context && !showOriginal && (
          <TranslatedBadge
            label={t("translatedByAi")}
            onShowOriginal={() => setShowOriginal(true)}
            showOriginalLabel={t("showOriginal")}
          />
        )}
      </div>
    );
  }

  // Inline mode styling
  if (inline) {
    if (context) {
      return (
        <span className="inline-flex flex-col">
          <span className={`whitespace-pre-wrap transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
            {displayText}
          </span>
          {loading && (
            <TranslatingIndicator label={t("translating")} inline />
          )}
        </span>
      );
    }

    return (
      <span className="inline-flex flex-col">
        <span className={`whitespace-pre-wrap transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
          {displayText}
        </span>
        {loading && (
          <TranslatingIndicator label={t("translating")} inline />
        )}
        {!loading && showOriginal && (
          <TranslateButton
            onClick={handleTranslate}
            label={t("translateTo", { language: t(`languages.${activeLocale}`) })}
            inline
          />
        )}
        {!loading && !showOriginal && (
          <TranslatedBadge
            label={t("translatedByAi")}
            onShowOriginal={() => setShowOriginal(true)}
            showOriginalLabel={t("showOriginal")}
            inline
          />
        )}
      </span>
    );
  }

  // If context is present, render clean layout without inline controls
  if (context) {
    return (
      <div className="flex flex-col">
        <p className={`whitespace-pre-wrap transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
          {displayText}
        </p>
        {loading && (
          <TranslatingIndicator label={t("translating")} />
        )}
      </div>
    );
  }

  // Standalone mode behavior
  return (
    <div className="flex flex-col">
      <p className={`whitespace-pre-wrap transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
        {displayText}
      </p>

      {loading && (
        <TranslatingIndicator label={t("translating")} />
      )}

      {!loading && showOriginal && (
        <TranslateButton
          onClick={handleTranslate}
          label={t("translateTo", { language: t(`languages.${activeLocale}`) })}
        />
      )}

      {!loading && !showOriginal && (
        <TranslatedBadge
          label={t("translatedByAi")}
          onShowOriginal={() => setShowOriginal(true)}
          showOriginalLabel={t("showOriginal")}
        />
      )}
    </div>
  );
}
