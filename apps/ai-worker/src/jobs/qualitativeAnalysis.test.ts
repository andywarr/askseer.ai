import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define the job data type for tests
interface ANJobData {
  version: 2;
  studyId: string;
  userId: string;
  teamId?: string;
  companyId?: string | null;
  type: "analyze";
  payload: {
    name?: string;
    goal?: string;
    researchQuestions?: string[];
    hypotheses?: string[];
    discussionGuide?: string;
    context?: string | null;
    files?: Array<{ name: string; key: string; size: number; type: string }>;
    contextFiles?: Array<{
      name: string;
      key: string;
      size: number;
      type: string;
    }>;
  };
  retry?: boolean;
}

type ProcessQualitativeAnalysisFn = (job: ANJobData) => Promise<void>;

// Create mock functions
const mockResponsesCreate = vi.fn();
const mockUpdateCredits = vi.fn().mockResolvedValue({});
const mockUpdateStatus = vi.fn().mockResolvedValue({});
const mockGetFiles = vi.fn();
const mockAddQualitativeAnalysis = vi.fn().mockResolvedValue(undefined);
const mockUpdateFileTranscript = vi.fn().mockResolvedValue(undefined);
const mockUpdateFileIdentifier = vi.fn().mockResolvedValue(undefined);
const mockGetPresignedUrl = vi
  .fn()
  .mockResolvedValue("https://presigned-url.example.com/file.txt");

// Mock class that will be used as OpenAI
class MockOpenAI {
  responses = { create: mockResponsesCreate };
  audio = {
    transcriptions: {
      create: vi.fn().mockResolvedValue({ text: "mock transcription" }),
    },
  };
}

// Mock external dependencies before importing the module
vi.mock("openai", () => ({
  default: MockOpenAI,
  toFile: vi.fn().mockResolvedValue({}),
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn().mockImplementation((schema, name) => ({
    type: "json_schema",
    name,
  })),
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

vi.mock("../lib/s3Client.ts", () => ({
  s3Client: {},
  getPresignedUrl: mockGetPresignedUrl,
  uploadBufferToS3: vi.fn().mockResolvedValue("key"),
}));

vi.mock("../lib/dbWorkerClient.ts", () => ({
  getFiles: mockGetFiles,
  addQualitativeAnalysis: mockAddQualitativeAnalysis,
  updateFileTranscript: mockUpdateFileTranscript,
  updateFileIdentifier: mockUpdateFileIdentifier,
  updateCredits: mockUpdateCredits,
  updateStatus: mockUpdateStatus,
}));

vi.mock("../lib/errorHandler.ts", async () => {
  return {
    handleProcessingError: vi
      .fn()
      .mockImplementation(async (jobData, _error, _jobType) => {
        if (!jobData.retry) {
          await mockUpdateCredits(jobData.userId, 1, jobData.studyId);
        }
        await mockUpdateStatus(jobData.studyId, "FAILED");
      }),
  };
});

// Mock withRetry to pass through without retries or delays
vi.mock("../lib/withRetry.ts", () => ({
  withRetry: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
    return fn();
  }),
}));

// Mock circuitBreaker to pass through
vi.mock("../lib/circuitBreaker.ts", () => ({
  openAiBreaker: {
    execute: vi
      .fn()
      .mockImplementation(async (fn: () => Promise<unknown>) => {
        return fn();
      }),
  },
  getCircuitBreakerStates: vi.fn().mockReturnValue({}),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ============================================================================
// Test helpers
// ============================================================================

const mockInsight = (title: string) => ({
  title,
  observation: `Observation for ${title}`,
  motivation: `Motivation for ${title}`,
  implication: `Implication for ${title}`,
  insightStatement: `Statement for ${title}`,
  theme: "Onboarding",
  severity: 3,
  participantCount: 2,
  quotes: [
    {
      quote: "This is a test quote",
      participant: "P1",
      timestamp: "00:05:30",
    },
  ],
  tags: ["pain-point"],
});

const mockAnalysisResult = (insightCount = 3) => ({
  summary: "Test summary",
  insights: Array.from({ length: insightCount }, (_, i) =>
    mockInsight(`Insight ${i + 1}`),
  ),
});

const mockInferenceResult = () => ({
  inferredGoal: "Test inferred goal",
  inferredQuestions: ["Q1?", "Q2?"],
  inferredGuide: "Test inferred guide",
});

const mockCodebook = () => ({
  themes: [
    {
      name: "Onboarding",
      definition: "User experiences during first-time setup",
      codes: ["setup-friction", "learning-curve", "aha-moment"],
    },
    {
      name: "Navigation",
      definition: "How users find and move between features",
      codes: ["wayfinding", "menu-confusion", "search-usage"],
    },
  ],
});

const mockIdentifiers = () => ({
  identifiers: [
    { fileName: "interview1.txt", identifier: "P1" },
    { fileName: "interview2.txt", identifier: "P2" },
  ],
});

const createMockJobData = (
  overrides: Partial<ANJobData> = {},
): ANJobData => ({
  version: 2,
  studyId: "study-123",
  userId: "user-456",
  teamId: "team-789",
  companyId: "company-abc",
  type: "analyze",
  payload: {
    name: "Test Analysis",
    goal: "Understand user onboarding experience",
    researchQuestions: ["How do users experience onboarding?"],
    discussionGuide: "1. Tell me about your first experience...",
    context: "A B2B SaaS product",
    files: [
      { name: "interview1.txt", key: "key1", size: 100, type: "text/plain" },
      { name: "interview2.txt", key: "key2", size: 200, type: "text/plain" },
    ],
  },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("qualitativeAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_WORKER_URL = "http://localhost:3001";
    process.env.AWS_BUCKET_NAME = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_SQS_QUEUE_URL = "https://sqs.test.com/queue";

    // Default: single ensemble run for simpler tests
    process.env.QA_ENSEMBLE_RUNS = "1";
    process.env.QA_REASONING_EFFORT = "high";
    process.env.QA_CONSENSUS_THRESHOLD = "2";

    // Default mock files from DB
    mockGetFiles.mockResolvedValue([
      {
        id: "file-1",
        originalName: "interview1.txt",
        key: "key1",
        size: 100,
        fileType: "DOCUMENT",
      },
      {
        id: "file-2",
        originalName: "interview2.txt",
        key: "key2",
        size: 200,
        fileType: "DOCUMENT",
      },
    ]);

    // Default fetch mock for text files
    mockFetch.mockResolvedValue({
      text: async () => "Interviewer: How was your experience?\nP1: It was great.",
      arrayBuffer: async () => new ArrayBuffer(0),
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("processQualitativeAnalysis", () => {
    it("should process analysis successfully with single run", async () => {
      // Mock OpenAI responses in order:
      // 1. Identifier extraction
      // 2. Codebook generation
      // 3. Analysis (single run)
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      const jobData = createMockJobData();
      await processQualitativeAnalysis(jobData);

      // Should save results
      expect(mockAddQualitativeAnalysis).toHaveBeenCalled();
      const savedResult = mockAddQualitativeAnalysis.mock.calls[0][1];
      expect(savedResult.insights).toHaveLength(3);
      expect(savedResult.summary).toBe("Test summary");
    });

    it("should skip inference when goal, questions, and guide are provided", async () => {
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      const jobData = createMockJobData();
      await processQualitativeAnalysis(jobData);

      // 3 calls: identifier, codebook, analysis (no inference since goal+questions+guide provided)
      expect(mockResponsesCreate).toHaveBeenCalledTimes(3);
    });

    it("should run inference when goal is missing", async () => {
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockInferenceResult()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      const jobData = createMockJobData({
        payload: {
          name: "Test Analysis",
          // No goal, no researchQuestions, no discussionGuide
          files: [
            {
              name: "interview1.txt",
              key: "key1",
              size: 100,
              type: "text/plain",
            },
          ],
        },
      });
      await processQualitativeAnalysis(jobData);

      // 4 calls: identifier, inference, codebook, analysis
      expect(mockResponsesCreate).toHaveBeenCalledTimes(4);

      const savedResult = mockAddQualitativeAnalysis.mock.calls[0][1];
      expect(savedResult.inferredGoal).toBe("Test inferred goal");
      expect(savedResult.inferredQuestions).toEqual(["Q1?", "Q2?"]);
    });

    it("should pass reasoning effort to all OpenAI calls", async () => {
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await processQualitativeAnalysis(createMockJobData());

      // Check all OpenAI calls have reasoning effort
      for (const call of mockResponsesCreate.mock.calls) {
        const params = call[0];
        expect(params.reasoning).toEqual({ effort: "high" });
      }
    });

    it("should run ensemble mode with N=3 and consolidation", async () => {
      process.env.QA_ENSEMBLE_RUNS = "3";

      mockResponsesCreate
        // Identifier extraction
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        // Codebook
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        // 3 analysis runs
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(3)),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(4)),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(2)),
        })
        // Consolidation
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(3)),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await processQualitativeAnalysis(createMockJobData());

      // 6 calls: identifier + codebook + 3 analysis runs + 1 consolidation
      expect(mockResponsesCreate).toHaveBeenCalledTimes(6);
      expect(mockAddQualitativeAnalysis).toHaveBeenCalled();
    });

    it("should fallback to first run when consolidation fails to parse", async () => {
      process.env.QA_ENSEMBLE_RUNS = "2";

      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        // 2 analysis runs
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(3)),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult(2)),
        })
        // Consolidation returns invalid JSON
        .mockResolvedValueOnce({
          output_text: "not valid json",
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await processQualitativeAnalysis(createMockJobData());

      // Should still save results (fallback to first run)
      expect(mockAddQualitativeAnalysis).toHaveBeenCalled();
      const savedResult = mockAddQualitativeAnalysis.mock.calls[0][1];
      // First run had 3 insights
      expect(savedResult.insights).toHaveLength(3);
    });

    it("should proceed without codebook if generation fails", async () => {
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        // Codebook generation fails
        .mockRejectedValueOnce(new Error("Codebook generation failed"))
        // Analysis still runs
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await processQualitativeAnalysis(createMockJobData());

      // Should still save results
      expect(mockAddQualitativeAnalysis).toHaveBeenCalled();
    });

    it("should handle errors and refund credits", async () => {
      // No files found
      mockGetFiles.mockResolvedValue([]);

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      const jobData = createMockJobData();

      await expect(processQualitativeAnalysis(jobData)).rejects.toThrow(
        "No files found",
      );

      // Should refund credits
      expect(mockUpdateCredits).toHaveBeenCalledWith(
        "user-456",
        1,
        "study-123",
      );
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should not refund credits on retry", async () => {
      mockGetFiles.mockResolvedValue([]);

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      const jobData = createMockJobData({ retry: true });

      await expect(processQualitativeAnalysis(jobData)).rejects.toThrow();

      // Should NOT refund credits on retry
      expect(mockUpdateCredits).not.toHaveBeenCalled();
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should throw when all ensemble runs return empty", async () => {
      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockCodebook()),
        })
        // Analysis returns empty
        .mockResolvedValueOnce({ output_text: "" });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await expect(
        processQualitativeAnalysis(createMockJobData()),
      ).rejects.toThrow("All analysis runs returned empty");
    });

    it("should include codebook themes in analysis prompt", async () => {
      const codebook = mockCodebook();

      mockResponsesCreate
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockIdentifiers()),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(codebook),
        })
        .mockResolvedValueOnce({
          output_text: JSON.stringify(mockAnalysisResult()),
        });

      const { processQualitativeAnalysis: _fn } = await import(
        "./qualitativeAnalysis"
      );
      const processQualitativeAnalysis =
        _fn as ProcessQualitativeAnalysisFn;

      await processQualitativeAnalysis(createMockJobData());

      // The analysis call (3rd call) should include codebook themes in the system prompt
      const analysisCall = mockResponsesCreate.mock.calls[2];
      const systemPrompt = analysisCall[0].input[0].content;
      expect(systemPrompt).toContain("Codebook");
      expect(systemPrompt).toContain("Onboarding");
      expect(systemPrompt).toContain("Navigation");
    });
  });
});
