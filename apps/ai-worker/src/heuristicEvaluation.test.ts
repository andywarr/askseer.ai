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
const mockUpdateCredits = vi.fn().mockResolvedValue({});
const mockUpdateStatus = vi.fn().mockResolvedValue({});
const mockGetFiles = vi.fn();
const mockGetPresignedUrl = vi.fn().mockResolvedValue("https://presigned-url.example.com/image.png");

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
  PutObjectCommand: vi.fn(),
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

// Mock the new modules
vi.mock("@/apps/ai-worker/src/s3Client.ts", () => ({
  s3Client: {},
  getPresignedUrl: mockGetPresignedUrl,
  uploadBufferToS3: vi.fn().mockResolvedValue("key"),
}));

vi.mock("@/apps/ai-worker/src/dbWorkerClient.ts", () => ({
  getFiles: mockGetFiles,
  getHeuristics: vi.fn(),
  addHeuristicEvaluation: vi.fn().mockResolvedValue(undefined),
  updateCredits: mockUpdateCredits,
  updateStatus: mockUpdateStatus,
}));

vi.mock("@/apps/ai-worker/src/errorHandler.ts", async () => {
  return {
    handleProcessingError: vi.fn().mockImplementation(async (jobData, error, jobType) => {
      // Simulate what the real handleProcessingError does
      if (!jobData.retry) {
        await mockUpdateCredits(jobData.userId, 1, jobData.studyId);
      }
      await mockUpdateStatus(jobData.studyId, "FAILED");
    }),
  };
});

vi.mock("@/apps/ai-worker/src/utils.ts", () => ({
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
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_SQS_QUEUE_URL = "https://sqs.test.com/queue";
    process.env.HE_EVAL_MODEL = "gpt-4o";
    process.env.HE_EVAL_CONCURRENCY = "2";
    process.env.HE_MAX_ATTEMPTS = "3";

    // Default mock for getFiles
    mockGetFiles.mockResolvedValue([
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
    ]);
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
      // Mock getHeuristics
      const { getHeuristics, addHeuristicEvaluation } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue(mockHeuristics);

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
      expect(getHeuristics).toHaveBeenCalledWith(
        "family-nielsen",
        "company-abc"
      );

      // Should have saved results to database
      expect(addHeuristicEvaluation).toHaveBeenCalled();
    });

    it("should handle evaluation with persona context", async () => {
      const { getHeuristics } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue(mockHeuristics);

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
      mockGetFiles.mockRejectedValue(new Error("Network error"));

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should refund credits
      expect(mockUpdateCredits).toHaveBeenCalledWith("user-456", 1, "study-123");

      // Should update status to failed
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should not refund credits on retry", async () => {
      mockGetFiles.mockRejectedValue(new Error("Network error"));

      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData({ retry: true });
      await processHeuristicEvaluation(jobData);

      // Should NOT refund credits on retry
      expect(mockUpdateCredits).not.toHaveBeenCalled();

      // Should still update status to failed
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should fail when heuristic family ID is not provided", async () => {
      const { processHeuristicEvaluation: _processHeuristicEvaluation } =
        await import("@/apps/ai-worker/src/heuristicEvaluation");
      const processHeuristicEvaluation =
        _processHeuristicEvaluation as ProcessHeuristicEvaluationFn;

      const jobData = createMockJobData({
        payload: {
          name: "Test",
          goal: "Test goal",
          // Missing heuristic field
        },
      });

      await processHeuristicEvaluation(jobData);

      // Should update status to failed
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should handle invalid OpenAI response format", async () => {
      const { getHeuristics } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue([mockHeuristics[0]]);

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

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should update status to failed due to JSON parse error
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should validate response against schema", async () => {
      const { getHeuristics } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue([mockHeuristics[0]]);

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

      const jobData = createMockJobData();
      await processHeuristicEvaluation(jobData);

      // Should update status to failed due to schema validation
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should evaluate all files against all heuristics", async () => {
      const { getHeuristics, addHeuristicEvaluation } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue(mockHeuristics);

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
      const { getHeuristics, addHeuristicEvaluation } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue([mockHeuristics[0]]);

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
      expect(addHeuristicEvaluation).toHaveBeenCalled();
    });

    it("should handle severity 4 (catastrophe)", async () => {
      const { getHeuristics, addHeuristicEvaluation } = await import("@/apps/ai-worker/src/dbWorkerClient");
      (getHeuristics as ReturnType<typeof vi.fn>).mockResolvedValue([mockHeuristics[0]]);

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
      expect(addHeuristicEvaluation).toHaveBeenCalled();
    });
  });
});
