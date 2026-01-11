import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define the job data type for tests to avoid importing from mocked modules
interface CWJobData {
  version: 2;
  studyId: string;
  userId: string;
  teamId?: string;
  companyId?: string | null;
  type: "cognitive_walkthrough";
  payload: {
    name?: string;
    goal?: string;
    user?: string | null;
    context?: string | null;
    files?: Array<{ name: string; key: string; size: number; type: string }>;
    persona?: {
      studyId?: string;
      name?: string;
      description?: string;
      data?: Record<string, unknown>;
    };
  };
  retry?: boolean;
}

// Type for the processCognitiveWalkthrough function
type ProcessCognitiveWalkthroughFn = (job: CWJobData) => Promise<void>;

// Create mock functions
const mockResponsesCreate = vi.fn();
const mockUpdateCredits = vi.fn().mockResolvedValue({});
const mockUpdateStatus = vi.fn().mockResolvedValue({});
const mockGetFiles = vi.fn();
const mockGetCWQuestions = vi.fn();
const mockAddCognitiveWalkthrough = vi.fn().mockResolvedValue(undefined);

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
  getPresignedUrl: vi.fn().mockResolvedValue("https://presigned-url.example.com/image.png"),
  uploadBufferToS3: vi.fn().mockResolvedValue("key"),
}));

vi.mock("@/apps/ai-worker/src/dbWorkerClient.ts", () => ({
  getFiles: mockGetFiles,
  getCWQuestions: mockGetCWQuestions,
  addCognitiveWalkthrough: mockAddCognitiveWalkthrough,
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
  deduplicateCognitiveWalkthrough: vi
    .fn()
    .mockImplementation((results) => results),
}));

describe("cognitiveWalkthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_WORKER_URL = "http://localhost:3001";
    process.env.AWS_BUCKET_NAME = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.AWS_SQS_QUEUE_URL = "https://sqs.test.com/queue";
    process.env.CW_MODEL = "gpt-4o";
    process.env.CW_MAX_ATTEMPTS = "3";

    // Default mock for getFiles
    mockGetFiles.mockResolvedValue([
      {
        id: "file-1",
        name: "step1.png",
        key: "studies/team-1/study-1/step1.png",
        size: 1024,
        type: "image/png",
      },
      {
        id: "file-2",
        name: "step2.png",
        key: "studies/team-1/study-1/step2.png",
        size: 2048,
        type: "image/png",
      },
      {
        id: "file-3",
        name: "step3.png",
        key: "studies/team-1/study-1/step3.png",
        size: 1536,
        type: "image/png",
      },
    ]);
  });

  afterEach(() => {
    vi.resetModules();
  });

  const mockQuestions = [
    { id: "q1", question: "Will the user try to achieve the right effect?" },
    {
      id: "q2",
      question:
        "Will the user notice that the correct action is available to them?",
    },
    {
      id: "q3",
      question:
        "Will the user associate the correct action with the effect they are trying to achieve?",
    },
    {
      id: "q4",
      question:
        "If the correct action is taken, will the user see that progress is being made toward the intended goal?",
    },
  ];

  const createMockJobData = (
    overrides: Partial<CWJobData> = {}
  ): CWJobData => ({
    version: 2,
    studyId: "study-123",
    userId: "user-456",
    teamId: "team-789",
    type: "cognitive_walkthrough",
    payload: {
      name: "Checkout Flow Walkthrough",
      goal: "Complete a purchase of a product in the shopping cart",
      user: "First-time e-commerce users",
      context: "Mobile app shopping experience",
    },
    ...overrides,
  });

  const createMockCWResponse = (step: number, hasIssues: boolean = false) => ({
    results: {
      step,
      expected: step === 1 ? true : step > 1,
      results: [
        { questionId: "q1", answer: "Yes, the user goal is clear" },
        { questionId: "q2", answer: "Yes, the action is visible" },
        {
          questionId: "q3",
          answer: hasIssues
            ? "No, the button label is confusing"
            : "Yes, the action is associated",
        },
        { questionId: "q4", answer: "Yes, progress feedback is provided" },
      ],
      issues: hasIssues
        ? [
            {
              issueType: "DISCOVERABILITY",
              issue:
                "The 'Proceed' button is not clearly labeled for checkout action",
              severity: 2,
              recommendations: [
                {
                  recommendation:
                    "Change button label to 'Proceed to Checkout'",
                },
              ],
            },
          ]
        : [],
    },
  });

  describe("processCognitiveWalkthrough", () => {
    it("should process cognitive walkthrough successfully", async () => {
      // Mock questions fetch
      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      // Mock OpenAI responses for each step
      let stepCount = 0;
      mockResponsesCreate.mockImplementation(() => {
        stepCount++;
        return Promise.resolve({
          output_text: JSON.stringify(createMockCWResponse(stepCount)),
          usage: { total_tokens: 600 },
          status: "completed",
        });
      });

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should have fetched CW questions
      expect(mockGetCWQuestions).toHaveBeenCalledWith(1);

      // Should have saved results to database
      expect(mockAddCognitiveWalkthrough).toHaveBeenCalled();

      // Should have processed all 3 steps (3 files)
      expect(mockResponsesCreate).toHaveBeenCalledTimes(3);
    });

    it("should process walkthrough with persona context", async () => {
      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      let stepCount = 0;
      mockResponsesCreate.mockImplementation(() => {
        stepCount++;
        return Promise.resolve({
          output_text: JSON.stringify(createMockCWResponse(stepCount)),
          usage: { total_tokens: 500 },
          status: "completed",
        });
      });

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData({
        payload: {
          name: "Senior User Checkout Walkthrough",
          goal: "Complete a purchase with accessibility considerations",
          persona: {
            studyId: "persona-study-1",
            name: "Robert",
            description: "70-year-old retiree with limited mobility",
            data: {
              demographics: {
                age: "70+",
                location: "Suburban",
              },
              behaviors: {
                techProficiency: "Low",
              },
            },
          },
        },
      });

      await processCognitiveWalkthrough(jobData);

      // Should include persona in the walkthrough
      expect(mockResponsesCreate).toHaveBeenCalled();
    });

    it("should handle walkthrough with issues detected", async () => {
      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      // Return responses with issues on step 2
      let stepCount = 0;
      mockResponsesCreate.mockImplementation(() => {
        stepCount++;
        const hasIssues = stepCount === 2;
        return Promise.resolve({
          output_text: JSON.stringify(
            createMockCWResponse(stepCount, hasIssues)
          ),
          usage: { total_tokens: 550 },
          status: "completed",
        });
      });

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should have processed all steps
      expect(mockResponsesCreate).toHaveBeenCalledTimes(3);

      // Should have saved to database including issues
      expect(mockAddCognitiveWalkthrough).toHaveBeenCalled();
    });

    it("should handle errors and refund credits", async () => {
      mockGetFiles.mockRejectedValue(new Error("Network error"));

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should refund credits
      expect(mockUpdateCredits).toHaveBeenCalledWith("user-456", 1, "study-123");

      // Should update status to failed
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should not refund credits on retry", async () => {
      mockGetFiles.mockRejectedValue(new Error("Network error"));

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData({ retry: true });
      await processCognitiveWalkthrough(jobData);

      // Should NOT refund credits on retry
      expect(mockUpdateCredits).not.toHaveBeenCalled();

      // Should still update status to failed
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should handle invalid OpenAI response format", async () => {
      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      // Return invalid JSON
      mockResponsesCreate.mockResolvedValue({
        output_text: "not valid json",
        usage: { total_tokens: 100 },
        status: "completed",
      });

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should update status to failed due to JSON parse error
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should validate response against schema", async () => {
      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      // Return response with invalid issue type
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          results: {
            step: 1,
            expected: true,
            results: [],
            issues: [
              {
                issueType: "INVALID_TYPE", // Invalid enum value
                issue: "Some issue",
                severity: 2,
                recommendations: [],
              },
            ],
          },
        }),
        usage: { total_tokens: 100 },
        status: "completed",
      });

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should update status to failed due to schema validation
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });

    it("should handle file with missing key", async () => {
      mockGetFiles.mockResolvedValue([
        {
          id: "file-1",
          name: "step1.png",
          key: null, // Missing key
          size: 1024,
          type: "image/png",
        },
      ]);

      mockGetCWQuestions.mockResolvedValue(mockQuestions);

      const { processCognitiveWalkthrough: _processCognitiveWalkthrough } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");
      const processCognitiveWalkthrough =
        _processCognitiveWalkthrough as ProcessCognitiveWalkthroughFn;

      const jobData = createMockJobData();
      await processCognitiveWalkthrough(jobData);

      // Should fail due to missing file key
      expect(mockUpdateStatus).toHaveBeenCalledWith("study-123", "FAILED");
    });
  });

  describe("cognitiveWalkthroughResultFormat schema", () => {
    it("should export a valid result format schema", async () => {
      const { cognitiveWalkthroughResultFormat } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");

      expect(cognitiveWalkthroughResultFormat).toBeDefined();

      // Valid input
      const validResult = {
        results: {
          step: 1,
          expected: true,
          results: [{ questionId: "q1", answer: "Yes" }],
          issues: [
            {
              issueType: "DISCOVERABILITY",
              issue: "Button not visible",
              severity: 2,
              recommendations: [{ recommendation: "Make button larger" }],
            },
          ],
        },
      };

      const parsed = cognitiveWalkthroughResultFormat.safeParse(validResult);
      expect(parsed.success).toBe(true);
    });

    it("should accept valid issue types", async () => {
      const { cognitiveWalkthroughResultFormat } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");

      const validTypes = ["DISCOVERABILITY", "LEARNABILITY", "USABILITY"];

      for (const issueType of validTypes) {
        const result = {
          results: {
            step: 1,
            expected: true,
            results: [],
            issues: [
              {
                issueType,
                issue: "Some issue",
                severity: 2,
                recommendations: [],
              },
            ],
          },
        };

        const parsed = cognitiveWalkthroughResultFormat.safeParse(result);
        expect(parsed.success).toBe(true);
      }
    });

    it("should reject invalid issue types", async () => {
      const { cognitiveWalkthroughResultFormat } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");

      const invalidResult = {
        results: {
          step: 1,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "INVALID", // Not a valid type
              issue: "Some issue",
              severity: 2,
              recommendations: [],
            },
          ],
        },
      };

      const parsed = cognitiveWalkthroughResultFormat.safeParse(invalidResult);
      expect(parsed.success).toBe(false);
    });

    it("should reject severity out of range", async () => {
      const { cognitiveWalkthroughResultFormat } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");

      const invalidResult = {
        results: {
          step: 1,
          expected: true,
          results: [],
          issues: [
            {
              issueType: "USABILITY",
              issue: "Some issue",
              severity: 5, // Max is 4
              recommendations: [],
            },
          ],
        },
      };

      const parsed = cognitiveWalkthroughResultFormat.safeParse(invalidResult);
      expect(parsed.success).toBe(false);
    });

    it("should accept severity 0 to 4", async () => {
      const { cognitiveWalkthroughResultFormat } =
        await import("@/apps/ai-worker/src/cognitiveWalkthrough");

      for (let severity = 0; severity <= 4; severity++) {
        const result = {
          results: {
            step: 1,
            expected: true,
            results: [],
            issues: [
              {
                issueType: "USABILITY",
                issue: "Some issue",
                severity,
                recommendations: [],
              },
            ],
          },
        };

        const parsed = cognitiveWalkthroughResultFormat.safeParse(result);
        expect(parsed.success).toBe(true);
      }
    });
  });
});
