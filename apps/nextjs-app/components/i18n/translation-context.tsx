"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { clearTranslationCache } from "./translation-wrapper";

interface TranslationContextType {
  isGlobalTranslated: boolean;
  setGlobalTranslated: (val: boolean) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// In-memory fallback if sessionStorage is unavailable
let inMemoryGlobalTranslated = false;

export function TranslationProvider({
  children,
  studyId,
}: {
  children: ReactNode;
  studyId?: string;
}) {
  const storageKey = studyId ? `askseer_global_translate_${studyId}` : "askseer_global_translate";

  const [isGlobalTranslated, setGlobalTranslatedState] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(storageKey);
        return stored === "true";
      } catch (e) {
        return inMemoryGlobalTranslated;
      }
    }
    return false;
  });

  // Sync state if storageKey changes dynamically (e.g. navigation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(storageKey);
        setGlobalTranslatedState(stored === "true");
      } catch (e) {
        setGlobalTranslatedState(inMemoryGlobalTranslated);
      }
    }
  }, [storageKey]);

  const setGlobalTranslated = (val: boolean) => {
    setGlobalTranslatedState(val);
    inMemoryGlobalTranslated = val;
    if (!val) {
      clearTranslationCache();
    }
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(storageKey, String(val));
      } catch (e) {
        // Ignore storage errors
      }
    }
  };

  return (
    <TranslationContext.Provider value={{ isGlobalTranslated, setGlobalTranslated }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslationContext() {
  return useContext(TranslationContext);
}
