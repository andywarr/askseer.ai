import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisInsights } from "./analysis-insights";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock useIsMobile hook
vi.mock("@/apps/nextjs-app/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Mock TranslationWrapper
vi.mock("@/apps/nextjs-app/components/i18n/translation-wrapper", () => ({
  TranslationWrapper: ({ text, sourceLocale }: any) => (
    <span data-testid="translation-wrapper" data-source-locale={sourceLocale}>
      {text}
    </span>
  ),
}));

// Mock EditableField
vi.mock("@/apps/nextjs-app/components/ui/editable-field", () => ({
  EditableField: ({ value, sourceLocale }: any) => (
    <div data-testid="editable-field" data-source-locale={sourceLocale}>
      {value}
    </div>
  ),
}));

// Mock Lucide Icons and MediaPlayer
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
  };
});

vi.mock("@/apps/nextjs-app/app/[locale]/(auth)/analysis/[id]/media-player", () => ({
  MediaPlayer: () => <div>MediaPlayer</div>,
}));

vi.mock("@/apps/nextjs-app/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <button>{children}</button>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/apps/nextjs-app/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/apps/nextjs-app/components/ui/button", () => ({
  Button: ({ children }: any) => <button>{children}</button>,
}));

vi.mock("@/apps/nextjs-app/components/ui/inline-action-button", () => ({
  InlineActionButton: ({ children }: any) => <button>{children}</button>,
}));

describe("AnalysisInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInsight = {
    id: "insight-1",
    title: "Insight Title",
    observation: "Insight Observation",
    motivation: "Insight Motivation",
    implication: "Insight Implication",
    insightStatement: "Insight Statement",
    severity: 3,
    theme: "Design Theme",
    tags: [{ id: "tag-1", tag: "Design Tag" }],
    quotes: [{ id: "quote-1", quote: "User quote content", participant: "P1", sourceFileId: null, timestamp: null }],
    source: "AI" as const,
    createdAt: new Date().toISOString(),
  };

  it("passes studyLocale to EditableField components and wraps title, quotes, tags and theme in TranslationWrapper", () => {
    render(
      <AnalysisInsights
        insights={[mockInsight]}
        studyId="study-1"
        canEdit={false}
        userId="user-1"
        qualitativeAnalysisId="qa-1"
        sourceFiles={[]}
        updateInsight={async () => ({ success: true, data: undefined })}
        deleteQuote={async () => ({ success: true, data: undefined })}
        addTag={async () => ({ success: true, data: { id: "tag-1", tag: "Design Tag" } })}
        removeTag={async () => ({ success: true, data: undefined })}
        deleteInsight={async () => ({ success: true, data: undefined })}
        addQuote={async () => ({ success: true, data: { id: "quote-1", quote: "User quote content" } })}
        addInsight={async () => ({ success: true, data: mockInsight })}
        studyLocale="fr"
      />
    );

    // Verify Title translated
    const wrappers = screen.getAllByTestId("translation-wrapper");
    expect(wrappers.some(w => w.textContent === "Insight Title" && w.getAttribute("data-source-locale") === "fr")).toBe(true);

    // Verify Theme translated
    expect(wrappers.some(w => w.textContent === "Design Theme" && w.getAttribute("data-source-locale") === "fr")).toBe(true);

    // Verify Tag translated
    expect(wrappers.some(w => w.textContent === "Design Tag" && w.getAttribute("data-source-locale") === "fr")).toBe(true);

    // Verify Quote translated
    expect(wrappers.some(w => w.textContent === "User quote content" && w.getAttribute("data-source-locale") === "fr")).toBe(true);

    // Verify EditableFields pass sourceLocale correctly
    const editableFields = screen.getAllByTestId("editable-field");
    expect(editableFields.length).toBeGreaterThanOrEqual(4);
    editableFields.forEach(field => {
      expect(field.getAttribute("data-source-locale")).toBe("fr");
    });
  });
});
