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
      deleteMany: vi.fn(),
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
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamMembership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
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
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    companyMembership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    // Notification support
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Communication preferences support
    communicationPreferences: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Credit ledger support
    creditLedger: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    // Additional models for user account deletion
    account: {
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    companyInvite: {
      deleteMany: vi.fn(),
    },
    teamInvite: {
      deleteMany: vi.fn(),
    },
    bookmarkedStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    // Heuristic models
    heuristicFamily: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    heuristic: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    heuristicExample: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // Company domain and visibility
    companyDomain: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    companyHeuristicVisibility: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
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
