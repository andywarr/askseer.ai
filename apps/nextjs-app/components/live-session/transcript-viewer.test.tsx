import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptViewer } from "./transcript-viewer";

// Mock TranslationWrapper to just render children directly in the test
vi.mock("@/apps/nextjs-app/components/i18n/translation-wrapper", () => ({
  TranslationWrapper: ({ children, text }: any) => {
    return <>{children(text)}</>;
  },
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("TranscriptViewer", () => {
  const sampleTranscript = `[00:05] Speaker A: Hello and welcome.\n[00:15] Speaker B: Thank you!`;

  it("renders parsed speaker-labeled transcript correctly", () => {
    render(<TranscriptViewer transcriptText={sampleTranscript} />);

    expect(screen.getByText("Speaker A:")).toBeInTheDocument();
    expect(screen.getByText("Hello and welcome.")).toBeInTheDocument();
    expect(screen.getByText("Speaker B:")).toBeInTheDocument();
    expect(screen.getByText("Thank you!")).toBeInTheDocument();
  });

  it("renders empty state when transcriptText is falsy", () => {
    render(<TranscriptViewer transcriptText="" />);
    expect(screen.getByText(/No transcript available yet/i)).toBeInTheDocument();
  });
});
