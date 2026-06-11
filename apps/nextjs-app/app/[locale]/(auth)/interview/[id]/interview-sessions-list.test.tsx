import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { InterviewSessionsList } from "./interview-sessions-list";
import { translateMessages } from "@/apps/nextjs-app/lib/actions/translate-actions";
import { useLocale } from "next-intl";
import { useTranslationContext } from "@/apps/nextjs-app/components/i18n/translation-context";
import { clearTranslationCache } from "@/apps/nextjs-app/components/i18n/translation-wrapper";

// Mock translate action
vi.mock("@/apps/nextjs-app/lib/actions/translate-actions", () => ({
  translateMessages: vi.fn(),
}));

// Mock requireAuth and balance/fund helpers from other modules
vi.mock("@/apps/nextjs-app/lib/actions/interview-actions", () => ({
  createInterviewSession: vi.fn(),
  getInterviewData: vi.fn(),
  deleteInterviewSessionAction: vi.fn(),
  renameInterviewSession: vi.fn(),
}));

vi.mock("@/apps/nextjs-app/lib/actions/study-lifecycle-actions", () => ({
  runInterviewAnalysis: vi.fn(),
}));

vi.mock("@/apps/nextjs-app/components/layout/team-balance-context", () => ({
  useTeamBalance: () => ({
    adjustBalance: vi.fn(),
  }),
}));

vi.mock("@/apps/nextjs-app/components/i18n/translation-context", () => ({
  useTranslationContext: vi.fn(() => null),
  TranslationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next-intl", async (importOriginal) => {
  const original = await importOriginal<typeof import("next-intl")>();
  return {
    ...original,
    useLocale: vi.fn(() => "en"),
    useTranslations: (namespace?: string) => {
      const messages: Record<string, string> = {
        "roleModerator": "Moderator",
        "roleParticipant": "Participant",
        "noTranscript": "No transcript",
        "translateTo": "Translate to {language}",
        "languages.en": "English",
        "languages.es": "Spanish",
        "languages.fr": "French",
        "languages.de": "German",
        "translatedByAi": "Translated by AI",
        "showOriginal": "Show original",
        "sessions": "Sessions",
        "sessionLabel": "Session {number}",
        "statusCompleted": "Completed",
      };
      return (key: string, values?: any) => {
        let val = messages[key] || key;
        if (values) {
          for (const [k, v] of Object.entries(values)) {
            val = val.replace(`{${k}}`, String(v));
          }
        }
        return val;
      };
    },
  };
});

describe("InterviewSessionsList - Transcript Translation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTranslationCache();
    (useLocale as Mock).mockReturnValue("en");
    (useTranslationContext as Mock).mockReturnValue(null);
  });

  const mockSessions = [
    {
      id: "sess-1",
      name: "Session 1",
      status: "COMPLETED",
      participantLink: "p-link-1",
      observerLink: "o-link-1",
      createdAt: new Date().toISOString(),
      locale: "es", // Mismatch with activeLocale ("en")
      messages: [
        { id: "m-1", speaker: "PARTICIPANT" as const, text: "Hola amigo", createdAt: new Date().toISOString() },
        { id: "m-2", speaker: "AI" as const, text: "Hola, ¿cómo estás?", createdAt: new Date().toISOString() },
      ],
    },
  ];

  it("renders messages in original language first and displays standalone translate button", async () => {
    render(
      <InterviewSessionsList
        studyId="study-1"
        interviewId="int-1"
        initialSessions={mockSessions}
        hasAnalysis={false}
        isCreator={true}
        balanceCents={1000}
        sessionCostCents={100}
      />
    );

    // Verify messages list is displayed
    expect(screen.getByText("Hola amigo")).toBeInTheDocument();
    expect(screen.getByText("Hola, ¿cómo estás?")).toBeInTheDocument();

    // Verify standalone Translate to English button is visible since locale is "es" and active is "en"
    const translateBtn = screen.getByRole("button", { name: "Translate to English" });
    expect(translateBtn).toBeInTheDocument();
  });

  it("translates messages on demand and displays translation attribution", async () => {
    (translateMessages as Mock).mockResolvedValue({
      success: true,
      data: [
        { id: "m-1", translatedText: "Hello friend" },
        { id: "m-2", translatedText: "Hello, how are you?" },
      ],
    });

    render(
      <InterviewSessionsList
        studyId="study-1"
        interviewId="int-1"
        initialSessions={mockSessions}
        hasAnalysis={false}
        isCreator={true}
        balanceCents={1000}
        sessionCostCents={100}
      />
    );

    const translateBtn = screen.getByRole("button", { name: "Translate to English" });
    fireEvent.click(translateBtn);

    await waitFor(() => {
      expect(translateMessages).toHaveBeenCalledWith(
        [
          { id: "m-1", text: "Hola amigo" },
          { id: "m-2", text: "Hola, ¿cómo estás?" },
        ],
        "en"
      );
    });

    // Check translated messages are visible
    expect(screen.getByText("Hello friend")).toBeInTheDocument();
    expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();

    // Check "Translated by AI" attribution is shown
    expect(screen.getByText("Translated by AI")).toBeInTheDocument();

    // Revert to original
    const showOriginalBtn = screen.getByRole("button", { name: "Show original" });
    fireEvent.click(showOriginalBtn);

    expect(screen.getByText("Hola amigo")).toBeInTheDocument();
  });

  it("automatically translates messages if global translation is active in context", async () => {
    (useTranslationContext as Mock).mockReturnValue({
      isGlobalTranslated: true,
      setGlobalTranslated: vi.fn(),
    });

    (translateMessages as Mock).mockResolvedValue({
      success: true,
      data: [
        { id: "m-1", translatedText: "Hello friend" },
        { id: "m-2", translatedText: "Hello, how are you?" },
      ],
    });

    render(
      <InterviewSessionsList
        studyId="study-1"
        interviewId="int-1"
        initialSessions={mockSessions}
        hasAnalysis={false}
        isCreator={true}
        balanceCents={1000}
        sessionCostCents={100}
      />
    );

    // Should translate automatically on mount without clicking
    await waitFor(() => {
      expect(translateMessages).toHaveBeenCalled();
    });

    expect(screen.getByText("Hello friend")).toBeInTheDocument();
    expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();

    // The standalone translation toggle should be hidden since context is active
    expect(screen.queryByRole("button", { name: "Translate to English" })).not.toBeInTheDocument();
  });
});
