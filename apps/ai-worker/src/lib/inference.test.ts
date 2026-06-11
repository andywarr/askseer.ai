import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define mock functions
const mockResponsesCreate = vi.fn();
const mockGetPresignedUrl = vi.fn();

// Mock dependencies with lazy evaluations
vi.mock("openai", () => ({
  default: class {
    responses = {
      create: (...args: any[]) => mockResponsesCreate(...args),
    };
  },
}));

vi.mock("./s3Client.ts", () => ({
  getPresignedUrl: (...args: any[]) => mockGetPresignedUrl(...args),
}));

vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { inferGoalFromScreenshots, generateStudyName } from "./inference.ts";
import type { File } from "../types.ts";

describe("Inference Localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/presigned-url");
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockFiles: File[] = [
    {
      name: "screen1.png",
      key: "studies/study-123/screen1.png",
      size: 1024,
      type: "image/png",
    },
  ];

  describe("inferGoalFromScreenshots", () => {
    const testCases = [
      { locale: undefined, expectedLanguage: "English" },
      { locale: "en", expectedLanguage: "English" },
      { locale: "en-US", expectedLanguage: "English" },
      { locale: "es", expectedLanguage: "Spanish" },
      { locale: "es-MX", expectedLanguage: "Spanish" },
      { locale: "de", expectedLanguage: "German" },
      { locale: "fr", expectedLanguage: "French" },
      { locale: "fr-CA", expectedLanguage: "French" },
      { locale: "it", expectedLanguage: "Italian" }, // Now supported in expanded language map
    ];

    testCases.forEach(({ locale, expectedLanguage }) => {
      it(`should request inferred goal in ${expectedLanguage} when locale is ${locale}`, async () => {
        mockResponsesCreate.mockResolvedValueOnce({
          output_text: JSON.stringify({
            goal: "A completely localized goal statement",
          }),
          status: "completed",
        });

        const goal = await inferGoalFromScreenshots(
          mockFiles,
          "study-123",
          "heuristic evaluation",
          locale
        );

        expect(goal).toBe("A completely localized goal statement");
        expect(mockResponsesCreate).toHaveBeenCalledTimes(1);

        const callArgs = mockResponsesCreate.mock.calls[0][0];
        const systemMessage = callArgs.input.find((msg: any) => msg.role === "system");
        
        expect(systemMessage).toBeDefined();
        expect(systemMessage.content).toContain(
          `IMPORTANT: The inferred goal MUST be written in ${expectedLanguage}.`
        );
      });
    });

    it("should throw error if openai returns empty response", async () => {
      mockResponsesCreate.mockResolvedValueOnce({
        output_text: "",
        status: "completed",
      });

      await expect(
        inferGoalFromScreenshots(mockFiles, "study-123", "heuristic evaluation")
      ).rejects.toThrow("Goal inference returned empty response");
    });
  });

  describe("generateStudyName", () => {
    const testCases = [
      { locale: undefined, expectedLanguage: "English" },
      { locale: "es", expectedLanguage: "Spanish" },
      { locale: "de", expectedLanguage: "German" },
      { locale: "fr", expectedLanguage: "French" },
      { locale: "ja", expectedLanguage: "Japanese" }, // Now supported in expanded language map
    ];

    testCases.forEach(({ locale, expectedLanguage }) => {
      it(`should request study name in ${expectedLanguage} when locale is ${locale}`, async () => {
        mockResponsesCreate.mockResolvedValueOnce({
          output_text: JSON.stringify({
            name: "A localized study name",
          }),
          status: "completed",
        });

        const studyName = await generateStudyName(
          "Goal text here",
          "study-123",
          locale
        );

        expect(studyName).toBe("A localized study name");
        expect(mockResponsesCreate).toHaveBeenCalledTimes(1);

        const callArgs = mockResponsesCreate.mock.calls[0][0];
        const systemMessage = callArgs.input.find((msg: any) => msg.role === "system");
        
        expect(systemMessage).toBeDefined();
        expect(systemMessage.content).toContain(
          `IMPORTANT: The generated study name MUST be written in ${expectedLanguage}.`
        );
      });
    });

    it("should return undefined if openai fails", async () => {
      mockResponsesCreate.mockRejectedValueOnce(new Error("API Error"));

      const studyName = await generateStudyName(
        "Goal text here",
        "study-123"
      );

      expect(studyName).toBeUndefined();
    });
  });
});
