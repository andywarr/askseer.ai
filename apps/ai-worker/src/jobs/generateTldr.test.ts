import { describe, it, expect, vi } from "vitest";

vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { buildTldrPrompt } from "./generateTldr.ts";

describe("buildTldrPrompt localization", () => {
  const baseStudy = {
    id: "study-123",
    type: "HEURISTIC_EVALUATION",
    name: "Checkout Usability Study",
    heuristicEvaluation: {
      results: [
        {
          violated: true,
          severity: 2,
          reason: "Buttons are too small",
          heuristic: { heuristic: "Aesthetic and minimalist design" },
          recommendations: [{ recommendation: "Increase button sizes" }],
        },
      ],
    },
  };

  const nonEnglishCases = [
    { locale: "es", expectedLanguage: "Spanish" },
    { locale: "de", expectedLanguage: "German" },
    { locale: "fr", expectedLanguage: "French" },
    { locale: "it", expectedLanguage: "Italian" }, // Now supported in expanded language map
  ];

  nonEnglishCases.forEach(({ locale, expectedLanguage }) => {
    it(`should append instructions to write key takeaways in ${expectedLanguage} when locale is ${locale}`, () => {
      const prompt = buildTldrPrompt(baseStudy, locale);
      expect(prompt).toContain(
        `IMPORTANT: The entire key takeaways document (including the title, description, and recommendations of each takeaway) MUST be written in ${expectedLanguage}.`
      );
    });
  });

  const englishCases = [
    { locale: undefined },
    { locale: "en" },
  ];

  englishCases.forEach(({ locale }) => {
    it(`should NOT append language instruction when locale is ${locale}`, () => {
      const prompt = buildTldrPrompt(baseStudy, locale);
      expect(prompt).not.toContain("IMPORTANT: The entire key takeaways document");
    });
  });

  describe("buildTldrPrompt no violations behavior", () => {
    it("should include instructions for handling empty violations when there are none", () => {
      const emptyStudy = {
        id: "study-empty",
        type: "HEURISTIC_EVALUATION",
        name: "Clean Checkout Study",
        heuristicEvaluation: {
          results: [
            {
              violated: false,
              severity: 0,
              reason: "Heuristic is followed perfectly",
              heuristic: { heuristic: "Aesthetic and minimalist design" },
              recommendations: [],
            },
          ],
        },
      };
      const prompt = buildTldrPrompt(emptyStudy);
      expect(prompt).toContain("No Issues / No Violations Policy");
    });
  });

  describe("buildTldrPrompt severity constraint", () => {
    it("should include instructions to not mention severity ratings in takeaways", () => {
      const prompt = buildTldrPrompt(baseStudy);
      expect(prompt).toContain("include or mention any severity ratings");
    });
  });
});



