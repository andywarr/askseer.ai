"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

const DEFAULT_RGB_VALUE = "255, 255, 255";
const TRANSPARENT_VALUES = new Set([
  "transparent",
  "rgba(0, 0, 0, 0)",
  "inherit",
]);

const extractRgbValues = (color: string): string | null => {
  const match = color.match(/rgba?\(([^)]+)\)/i);

  if (!match) {
    return null;
  }

  const channels = match[1]
    .split(",")
    .slice(0, 3)
    .map((channel) => Number.parseFloat(channel.trim()))
    .filter((value) => Number.isFinite(value));

  if (channels.length !== 3) {
    return null;
  }

  return channels.join(", ");
};

const resolveBackgroundColor = (element: HTMLElement | null): string => {
  if (typeof window === "undefined") {
    return DEFAULT_RGB_VALUE;
  }

  let current: HTMLElement | null = element;

  while (current) {
    const color = window.getComputedStyle(current).backgroundColor;

    if (color && !TRANSPARENT_VALUES.has(color)) {
      return color;
    }

    current = current.parentElement;
  }

  return window.getComputedStyle(document.body).backgroundColor ?? "rgb(255, 255, 255)";
};

export const useEdgeFadeColor = (
  containerRef: RefObject<HTMLElement>,
): { fadeColor: string; refreshFadeColor: () => void } => {
  const [fadeColor, setFadeColor] = useState<string>(DEFAULT_RGB_VALUE);

  const refreshFadeColor = useCallback(() => {
    const resolvedColor = resolveBackgroundColor(containerRef.current);
    const rgbValues = extractRgbValues(resolvedColor);

    setFadeColor(rgbValues ?? DEFAULT_RGB_VALUE);
  }, [containerRef]);

  useEffect(() => {
    refreshFadeColor();

    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = () => refreshFadeColor();

    mediaQuery.addEventListener?.("change", handleSchemeChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleSchemeChange);
    };
  }, [refreshFadeColor]);

  return { fadeColor, refreshFadeColor };
};
