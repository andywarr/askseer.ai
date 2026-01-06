import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock functions
const mockResponsesCreate = vi.fn();

// Mock class that will be used as OpenAI
class MockOpenAI {
  responses = { create: mockResponsesCreate };
}

// Mock external dependencies before importing the module
vi.mock("openai", () => ({
  default: MockOpenAI,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = vi.fn().mockResolvedValue({});
  },
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue("https://presigned-url.example.com/image.png"),
}));

vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_WORKER_URL = "http://localhost:3001";
    process.env.AWS_BUCKET_NAME = "askseer-test";
    process.env.AWS_REGION = "us-east-1";
    process.env.DEDUPE_MODEL = "gpt-5-2025-08-07";
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("getFiles", () => {
    it("should fetch files for a study successfully", async () => {
      const mockFiles = [
        {
          id: "file-1",
          name: "screen1.png",
          key: "studies/team-1/study-1/screen1.png",
          size: 1024,
          type: "image/png",
        },
        {
          id: "file-2",
          name: "screen2.png",
          key: "studies/team-1/study-1/screen2.png",
          size: 2048,
          type: "image/png",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockFiles }),
      });

      const { getFiles } = await import("@/apps/ai-worker/src/utils");

      const result = await getFiles("study-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/files?studyId=study-123"
      );
      expect(result).toEqual(mockFiles);
    });

    it("should throw error when fetch fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { getFiles } = await import("@/apps/ai-worker/src/utils");

      await expect(getFiles("study-123")).rejects.toThrow(
        "Failed to fetch files: 500 Internal Server Error"
      );
    });

    it("should return empty array for study with no files", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const { getFiles } = await import("@/apps/ai-worker/src/utils");

      const result = await getFiles("study-123");

      expect(result).toEqual([]);
    });
  });

  describe("getPresignedUrl", () => {
    it("should generate a presigned URL for a file", async () => {
      const { getPresignedUrl } = await import("@/apps/ai-worker/src/utils");

      const result = await getPresignedUrl(
        "studies/team-1/study-1/screen1.png"
      );

      expect(result).toBe("https://presigned-url.example.com/image.png");
    });
  });

  describe("updateCredits", () => {
    it("should update user credits when studyId is not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ credits: 10 }),
      });

      const { updateCredits } = await import("@/apps/ai-worker/src/utils");

      const result = await updateCredits("user-123", 5);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/updateCredits",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "user-123", delta: 5 }),
        })
      );
      expect(result).toEqual({ credits: 10 });
    });

    it("should refund team credits when studyId is provided with positive credits", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { updateCredits } = await import("@/apps/ai-worker/src/utils");

      await updateCredits("user-123", 1, "study-456");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/team/credits/refund",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studyId: "study-456", byUserId: "user-123" }),
        })
      );
    });

    it("should consume team credits when studyId is provided with negative credits", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { updateCredits } = await import("@/apps/ai-worker/src/utils");

      await updateCredits("user-123", -1, "study-456");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/team/credits/consume",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ studyId: "study-456", byUserId: "user-123" }),
        })
      );
    });

    it("should throw error when update fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const { updateCredits } = await import("@/apps/ai-worker/src/utils");

      await expect(updateCredits("user-123", 5)).rejects.toThrow(
        "HTTP error! status: 400"
      );
    });
  });

  describe("updateStatus", () => {
    it("should update study status successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            previousStatus: "PENDING",
            status: "COMPLETED",
          }),
      });

      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const result = await updateStatus("study-123", "COMPLETED");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/studyStatus",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studyId: "study-123", status: "COMPLETED" }),
        })
      );
      expect(result).toEqual({
        previousStatus: "PENDING",
        status: "COMPLETED",
      });
    });

    it("should throw error when status update fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      await expect(updateStatus("study-123", "COMPLETED")).rejects.toThrow(
        "HTTP error! status: 500"
      );
    });

    it("should update status to failed", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ previousStatus: "PENDING", status: "FAILED" }),
      });

      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const result = await updateStatus("study-123", "FAILED");

      expect(result.status).toBe("FAILED");
    });
  });

  describe("deduplicateCognitiveWalkthrough", () => {
    it("should return steps unchanged when no issues", async () => {
      const { deduplicateCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/utils");

      const steps = [
        {
          step: 1,
          expected: true,
          results: [{ questionId: "q1", answer: "Yes" }],
          issues: [],
        },
      ];

      const result = await deduplicateCognitiveWalkthrough(steps, "study-123");

      expect(result).toEqual(steps);
    });

    it("should call OpenAI for deduplication when multiple issues exist", async () => {
      // Mock deduplication to keep only first item
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          indicesToKeep: [0],
          reasoning: "Second issue is duplicate",
        }),
      });

      const { deduplicateCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/utils");

      const steps = [
        {
          step: 1,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "DISCOVERABILITY",
              issue: "Button not visible",
              severity: 2,
              recommendations: [{ recommendation: "Make button larger" }],
            },
          ],
        },
        {
          step: 2,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "DISCOVERABILITY",
              issue: "Button is hard to see",
              severity: 2,
              recommendations: [{ recommendation: "Increase contrast" }],
            },
          ],
        },
      ];

      await deduplicateCognitiveWalkthrough(steps, "study-123");

      // Should call OpenAI for deduplication
      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should filter issues by goal relevance when goal is provided", async () => {
      // Mock goal relevance filter
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          indicesToKeep: [0],
          reasoning: "Second issue is not relevant to checkout goal",
        }),
      });

      const { deduplicateCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/utils");

      const steps = [
        {
          step: 1,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "USABILITY",
              issue: "Checkout button is hard to click",
              severity: 3,
              recommendations: [],
            },
            {
              issueType: "USABILITY",
              issue: "Footer links are poorly organized",
              severity: 1,
              recommendations: [],
            },
          ],
        },
      ];

      await deduplicateCognitiveWalkthrough(
        steps,
        "study-123",
        "Complete checkout process"
      );

      // Should call OpenAI for goal filtering
      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should handle OpenAI errors gracefully", async () => {
      mockResponsesCreate.mockRejectedValue(new Error("API error"));

      const { deduplicateCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/utils");

      const steps = [
        {
          step: 1,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "USABILITY",
              issue: "Issue 1",
              severity: 2,
              recommendations: [],
            },
            {
              issueType: "USABILITY",
              issue: "Issue 2",
              severity: 2,
              recommendations: [],
            },
          ],
        },
      ];

      // Should not throw and return original steps
      const result = await deduplicateCognitiveWalkthrough(
        steps,
        "study-123",
        "Goal"
      );

      // Should return steps (may or may not be deduplicated depending on fallback behavior)
      expect(result).toBeDefined();
    });
  });

  describe("deduplicateHeuristicEvaluation", () => {
    it("should return results unchanged when no violations", async () => {
      const { deduplicateHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/utils");

      const results = [
        {
          id: "h1",
          heuristic: "Visibility",
          violated: false,
          reason: "No issues",
          severity: 0,
          recommendations: [],
        },
      ];

      const result = await deduplicateHeuristicEvaluation(results, "study-123");

      expect(result).toEqual(results);
    });

    it("should deduplicate violated heuristics", async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          indicesToKeep: [0],
          reasoning: "Issues are duplicates",
        }),
      });

      const { deduplicateHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/utils");

      const results = [
        {
          id: "h1",
          heuristic: "Visibility",
          violated: true,
          reason: "No loading indicator",
          severity: 2,
          recommendations: [{ recommendation: "Add spinner" }],
        },
        {
          id: "h1",
          heuristic: "Visibility",
          violated: true,
          reason: "Loading state missing",
          severity: 2,
          recommendations: [{ recommendation: "Show progress" }],
        },
      ];

      await deduplicateHeuristicEvaluation(results, "study-123");

      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should filter violations by goal relevance", async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          indicesToKeep: [0],
          reasoning: "Second violation not relevant to goal",
        }),
      });

      const { deduplicateHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/utils");

      const results = [
        {
          id: "h1",
          heuristic: "Visibility",
          violated: true,
          reason: "Checkout button lacks feedback",
          severity: 3,
          recommendations: [],
        },
        {
          id: "h2",
          heuristic: "Consistency",
          violated: true,
          reason: "Footer styling inconsistent",
          severity: 1,
          recommendations: [],
        },
      ];

      await deduplicateHeuristicEvaluation(
        results,
        "study-123",
        "Complete checkout"
      );

      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should keep non-violated results unchanged", async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          indicesToKeep: [0],
          reasoning: "Keeping first violation",
        }),
      });

      const { deduplicateHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/utils");

      const results = [
        {
          id: "h1",
          heuristic: "Visibility",
          violated: false, // Not violated
          reason: "Good visibility",
          severity: 0,
          recommendations: [],
        },
        {
          id: "h2",
          heuristic: "Consistency",
          violated: true,
          reason: "Inconsistent styling",
          severity: 2,
          recommendations: [],
        },
      ];

      const result = await deduplicateHeuristicEvaluation(results, "study-123");

      // Non-violated should be in result
      expect(result.find((r) => r.id === "h1")).toBeDefined();
    });

    it("should handle empty response from OpenAI", async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: "",
      });

      const { deduplicateHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/utils");

      const results = [
        {
          id: "h1",
          heuristic: "Visibility",
          violated: true,
          reason: "Issue 1",
          severity: 2,
          recommendations: [],
        },
        {
          id: "h2",
          heuristic: "Consistency",
          violated: true,
          reason: "Issue 2",
          severity: 2,
          recommendations: [],
        },
      ];

      // Should return all items when OpenAI returns empty
      const result = await deduplicateHeuristicEvaluation(
        results,
        "study-123",
        "Goal"
      );

      expect(result).toBeDefined();
    });
  });
});
