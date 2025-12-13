import { vi, beforeEach } from "vitest";

// Mock the Prisma client
vi.mock("@/apps/db-worker/src/services/db.ts", () => {
  return {
    default: createMockPrismaClient(),
  };
});

// Mock the logger
vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Create a mock Prisma client factory
export function createMockPrismaClient() {
  return {
    study: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    file: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    cognitiveWalkthrough: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    heuristicEvaluation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    persona: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    teamMembership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    cWQuestion: {
      findMany: vi.fn(),
    },
    cWStep: {
      findUnique: vi.fn(),
    },
    cWIssue: {
      findUnique: vi.fn(),
    },
    cWRecommendation: {
      findUnique: vi.fn(),
    },
    hEResult: {
      findUnique: vi.fn(),
    },
    hERecommendation: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    companyMembership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: any) => Promise<any>) =>
      callback(createMockPrismaClient())
    ),
  };
}

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
