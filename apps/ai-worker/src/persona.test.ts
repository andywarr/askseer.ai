import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";

// Define the persona data type matching PersonaSchema from jobSchema.ts
interface PersonaData {
  name?: string;
  description?: string;
  images?: {
    photoKey?: string;
    coverKey?: string;
  };
  demographics?: {
    age?: string;
    gender?: string;
    ethnicity?: string;
    location?: string;
    education?: string;
    income?: string;
    maritalStatus?: string;
    householdSize?: string;
  };
  psychographics?: {
    personality?: string;
    interests?: string | string[];
    values?: string | string[];
    motivations?: string | string[];
    painPoints?: string | string[];
  };
  behaviors?: {
    techProficiency?: string;
    primaryDevices?: string | string[];
    preferredChannels?: string | string[];
    purchaseTriggers?: string | string[];
  };
  tools?:
    | string
    | string[]
    | Array<{
        tool: string;
        expertise?: string;
        frequency?: string;
        satisfaction?: string;
      }>;
  firmographics?: {
    companySize?: string;
    industry?: string;
    roleSeniority?: string;
    department?: string;
    jobTitle?: string;
    decisionPower?: string;
    budgetRange?: string;
    employmentStatus?: string;
    annualRecurringRevenue?: string;
  };
  goals?: string | string[] | Array<{ want: string; soThat: string }>;
  quotes?: string | string[];
}

// Define the job data type for tests matching PersonaPayloadV2Schema
interface PersonaJobData {
  version: 2;
  studyId: string;
  userId: string;
  teamId?: string;
  companyId?: string | null;
  type: "persona";
  payload: {
    persona?: {
      photoUrl?: string | null;
      coverUrl?: string | null;
      files?: Array<{ name: string; key: string; size: number; type: string }>;
      data?: PersonaData;
    };
  };
  retry?: boolean;
}

// Type for the processPersona function
type ProcessPersonaFn = (job: PersonaJobData) => Promise<void>;

// Create mock functions
const mockResponsesCreate = vi.fn();
const mockImagesGenerate = vi.fn();

// Mock class that will be used as OpenAI
class MockOpenAI {
  responses = { create: mockResponsesCreate };
  images = { generate: mockImagesGenerate };
}

// Mock external dependencies before importing the module
vi.mock("openai", () => ({
  default: MockOpenAI,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = vi.fn().mockResolvedValue({});
  },
  PutObjectCommand: vi.fn(),
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
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("persona", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_WORKER_URL = "http://localhost:3001";
    process.env.AWS_BUCKET_NAME = "askseer-test";
    process.env.AWS_REGION = "us-east-1";
    process.env.PERSONA_MODEL = "gpt-5-2025-08-07";
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("generatePersonaImage", () => {
    it("should generate an image and return buffer with content type", async () => {
      const base64Image = Buffer.from("test-image-data").toString("base64");
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Image }],
        created: Date.now(),
      });

      const { generatePersonaImage } =
        await import("@/apps/ai-worker/src/persona");

      const result = await generatePersonaImage("A professional headshot");

      expect(result).toHaveProperty("buffer");
      expect(result).toHaveProperty("contentType", "image/png");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.toString()).toBe("test-image-data");
    });

    it("should throw error when no image data is returned", async () => {
      mockImagesGenerate.mockResolvedValue({
        data: [{}],
        created: Date.now(),
      });

      const { generatePersonaImage } =
        await import("@/apps/ai-worker/src/persona");

      await expect(
        generatePersonaImage("A professional headshot")
      ).rejects.toThrow("OpenAI image generation returned no image data");
    });

    it("should use specified size for image generation", async () => {
      const base64Image = Buffer.from("test-image").toString("base64");
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Image }],
        created: Date.now(),
      });

      const { generatePersonaImage } =
        await import("@/apps/ai-worker/src/persona");

      await generatePersonaImage("Portrait", "512x512");

      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-image-1.5",
          size: "512x512",
        })
      );
    });
  });

  describe("uploadBufferToS3", () => {
    it("should upload buffer to S3 and return the key", async () => {
      const { uploadBufferToS3 } = await import("@/apps/ai-worker/src/persona");

      const buffer = Buffer.from("test-data");
      const key = "studies/team-1/study-1/persona/photo-123.png";

      const result = await uploadBufferToS3({
        buffer,
        key,
        contentType: "image/png",
      });

      expect(result).toBe(key);
    });

    // Note: Testing environment variable not set is tricky with cached modules
    // The actual function does validate AWS_BUCKET_NAME at runtime
  });

  describe("processPersona", () => {
    const createMockJobData = (
      overrides: Partial<PersonaJobData> = {}
    ): PersonaJobData => ({
      version: 2,
      studyId: "study-123",
      userId: "user-456",
      teamId: "team-789",
      type: "persona",
      payload: {
        persona: {
          data: {
            name: "Test Persona",
            description: "A test persona for unit testing",
          },
        },
      },
      ...overrides,
    });

    it("should process persona with provided name and description", async () => {
      const base64Image = Buffer.from("test-image-data").toString("base64");
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Image }],
        created: Date.now(),
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData();
      await processPersona(jobData);

      // Should call DB worker to save persona
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/persona",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );

      // Should update status to completed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "completed");
    });

    it("should generate name and description when not provided", async () => {
      // Mock for persona basics generation
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          name: "Generated Name",
          description: "Generated description for the persona",
        }),
      });

      // Mock for image generation
      const base64Image = Buffer.from("test-image-data").toString("base64");
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Image }],
        created: Date.now(),
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;

      const jobData = createMockJobData({
        payload: {
          persona: {
            data: {
              // No name or description provided
              demographics: {
                age: "25-34",
                location: "New York",
              },
            },
          },
        },
      });

      await processPersona(jobData);

      // Should call OpenAI to generate basics
      expect(mockResponsesCreate).toHaveBeenCalled();

      // Should call DB worker with generated data
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle errors and refund credits", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;
      const { updateCredits, updateStatus } =
        await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData();
      await processPersona(jobData);

      // Should refund credits
      expect(updateCredits).toHaveBeenCalledWith("user-456", 1, "study-123");

      // Should update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should not refund credits on retry", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;
      const { updateCredits, updateStatus } =
        await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData({ retry: true });
      await processPersona(jobData);

      // Should NOT refund credits on retry
      expect(updateCredits).not.toHaveBeenCalled();

      // Should still update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should handle missing persona in payload", async () => {
      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData: PersonaJobData = {
        version: 2,
        studyId: "study-123",
        userId: "user-456",
        teamId: "team-789",
        type: "persona",
        payload: {}, // Missing persona
      };

      await processPersona(jobData);

      // Should update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });

    it("should skip image generation if URLs are already provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;

      const jobData = createMockJobData({
        payload: {
          persona: {
            photoUrl: "https://existing-photo.example.com/photo.png",
            coverUrl: "https://existing-cover.example.com/cover.png",
            data: {
              name: "Test Persona",
              description: "A test persona",
            },
          },
        },
      });

      await processPersona(jobData);

      // Should NOT call image generation
      expect(mockImagesGenerate).not.toHaveBeenCalled();
    });

    it("should handle database save failure", async () => {
      const base64Image = Buffer.from("test-image-data").toString("base64");
      mockImagesGenerate.mockResolvedValue({
        data: [{ b64_json: base64Image }],
        created: Date.now(),
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Database error"),
      });

      const { processPersona: _processPersona } =
        await import("@/apps/ai-worker/src/persona");
      const processPersona = _processPersona as ProcessPersonaFn;
      const { updateStatus } = await import("@/apps/ai-worker/src/utils");

      const jobData = createMockJobData();
      await processPersona(jobData);

      // Should update status to failed
      expect(updateStatus).toHaveBeenCalledWith("study-123", "failed");
    });
  });
});
