import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditableSummary } from "./editable-summary";

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

describe("EditableSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the summary inside TranslationWrapper with studyLocale", () => {
    render(
      <EditableSummary
        summary="This is a test summary content."
        summarySource="AI"
        qualitativeAnalysisId="qa-1"
        userId="user-1"
        studyId="study-1"
        canEdit={false}
        updateSummary={async () => ({ success: true, data: undefined })}
        studyLocale="es"
      />
    );

    const wrapper = screen.getByTestId("translation-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveTextContent("This is a test summary content.");
    expect(wrapper.getAttribute("data-source-locale")).toBe("es");
  });
});
