import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define the job data type for tests to avoid importing from mocked modules
// Note: heuristic is optional here to test error cases where it's missing
interface HEJobData {
  version: 2;
  studyId: string;
  userId: string;
  teamId?: string;
  companyId?: string | null;
  type: "heuristic_evaluation";
  payload: {
    name?: string;
    goal?: string;
    user?: string | null;
    context?: string | null;
    files?: Array<{ name: string; key: string; size: number; type: string }>;
    heuristic?: string;
    persona?: {
      studyId?: string;
      name?: string;
      description?: string;
      data?: Record<string, unknown>;
    };
  };
  retry?: boolean;
}

// Type for the processHeuristicEvaluation function
type ProcessHeuristicEvaluationFn = (job: HEJobData) => Promise<void>;

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
  getSignedUrl: vi.fn().mockResolvedValue("https://presigned-url.example.com"),
}));

vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/apps/ai-worker/src/utils.ts", () => ({
  updateCredits: vi.fn().mockResolvedValue({}),
  updateStatus: vi.fn().mockResolvedValue({}),
  getPresignedUrl: vi
    .fn()
    .mockResolvedValue("https://presigned-url.example.com/image.png"),
  getFiles: vi.fn().mockResolvedValue([
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
  ]),
  deduplicateHeuristicEvaluation: vi
    .fn()
    .mockImplementation((results) => results),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("heuristicEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_WORKER_URL = "http://localhost:3001";
    process.env.AWS_BUCKET_NAME = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.HE_EVAL_MODEL = "gpt-4o";
    process.env.HE_EVAL_CONCURRENCY = "2";
    process.env.HE_MAX_ATTEMPTS = "3";
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockHeuristics = [
    {
      id: "h1",
      heuristic: "Visibility of system status",
      label: "System Status",
      description:
        "The system should always keep users informed about what is going on",
      examples: [
        { id: "ex1", title: "Loading indicator", example: "No loading state" },
      ],
    },
    {
      id: "h2",
      heuristic: "Match between system and real world",
      label: "Real World Match",
      description:
        "The system should speak the users language, with words and concepts familiar to the user",
      examples: [],
    },
  ];

  const createMockJobData = (
    overrides: Partial<HEJobData> = {}
  ): HEJobData => ({
    version: 2,
    studyId: "study-123",
    userId: "user-456",
    teamId: "team-789",
    companyId: "company-abc",
    type: "heuristic_evaluation",
    payload: {
      name: "Test Evaluation",
      goal: "Evaluate the checkout flow for usability issues",
      user: "E-commerce shoppers aged 25-45",
      context: "Desktop web application for online shopping",
      heuristic: "family-nielsen",
    },
    ...overrides,
  });

  describe("processHeuristicEvaluation", () => {
    it("should process heuristic evaluation successfully", async () => {
      // Mock heuristics fetch
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockHeuristics }),
          });
        }
        if (url.includes("/api/heuristicEvaluation")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      // Mock OpenAI evaluation response
      const mockEvaluationResult = {
        violated: true,
        reason: "No loading indicator visible during checkout process",
        severity: 3,
        recommendations: [
          { recommendation: "Add a spinner or progress bar during loading" },
        ],
      };

      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify(mockEvaluationResult),
        usage: { total_tokens: 500 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should have fetched heuristics
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/heuristics")
      );

      // Should have saved results to database
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/heuristicEvaluation",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should handle evaluation with persona context", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockHeuristics }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const mockEvaluationResult = {
        violated: false,
        reason: "The interface provides clear feedback for all actions",
        severity: 0,
        recommendations: [],
      };

      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify(mockEvaluationResult),
        usage: { total_tokens: 400 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData({
        payload: {
          name: "Test Evaluation with Persona",
          goal: "Evaluate for senior users",
          heuristic: "family-nielsen",
          persona: {
            studyId: "persona-study-1",
            name: "Margaret",
            description: "65-year-old retiree new to online shopping",
            data: {
              demographics: {
                age: "65+",
                techProficiency: "Low",
              },
            },
          },
        },
      });

      await processHeuristicEvaluation(jobData);

      // Should include persona in the evaluation
      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should handle errors and refund credits", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;
      const { updateCredits, updateStatus } = await import(
        "@/apps/ai-worker/src/utils"
      );

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should refund credits
      expect(updateCredits).toHaveBeenCalledWith("user-456", 1, "study-123");

      // Should update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should not refund credits on retry", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;
      const { updateCredits, updateStatus } = await import(
        "@/apps/ai-worker/src/utils"
      );

      const jobData = createMockJobData({ retry: true });
      await processHeuristicEvaluation(jobData);

      // Should NOT refund credits on retry
      expect(updateCredits).not.toHaveBeenCalled();

      // Should still update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should fail when heuristic family ID is not provided", async () => {
      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData({
        payload: {
          name: "Test",
          goal: "Test goal",
          // Missing heuristic field
        },
      });

      await processHeuristicEvaluation(jobData);

      // Should update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should handle invalid OpenAI response format", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [mockHeuristics[0]] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // Return invalid JSON
      mockResponsesCreate.mockResolvedValue({
        output_text: "not valid json",
        usage: { total_tokens: 100 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should update status to failed due to JSON parse error
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should validate response against schema", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [mockHeuristics[0]] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      // Return response missing required fields
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          violated: true,
          // Missing reason, severity, recommendations
        }),
        usage: { total_tokens: 100 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should update status to failed due to schema validation
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should evaluate all files against all heuristics", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockHeuristics }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          violated: false,
          reason: "No issues found",
          severity: 0,
          recommendations: [],
        }),
        usage: { total_tokens: 300 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should have evaluated: 2 files * 2 heuristics = 4 evaluations
      expect(mockResponsesCreate).toHaveBeenCalledTimes(4);
    });
  });

  describe("evaluation severity levels", () => {
    it("should handle severity 0 (not a problem)", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [mockHeuristics[0]] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          violated: false,
          reason: "System status is clearly visible",
          severity: 0,
          recommendations: [],
        }),
        usage: { total_tokens: 200 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should process successfully
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/heuristicEvaluation",
        expect.anything()
      );
    });

    it("should handle severity 4 (catastrophe)", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/heuristics")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [mockHeuristics[0]] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          violated: true,
          reason: "Critical error handling missing, users lose all data",
          severity: 4,
          recommendations: [
            { recommendation: "Implement auto-save functionality" },
            { recommendation: "Add error recovery mechanism" },
          ],
        }),
        usage: { total_tokens: 250 },
        status: "completed",
      });

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should process successfully with high severity
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/heuristicEvaluation",
        expect.anything()
      );
    });
  });
});
