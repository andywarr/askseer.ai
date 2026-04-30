// =============================================================================
// Database Services - Main Entry Point
// =============================================================================
// This file re-exports all database service functions from their domain-specific
// modules. The original monolithic databaseService.ts has been split into:
//
// - shared/       - Error classes, helper functions, types, authorization
// - storage/      - S3 operations
// - study/        - Study CRUD, CW, HE, Persona operations
// - user/         - User CRUD, notifications, communication preferences
// - team/         - Team CRUD, memberships, join requests
// - company/      - Company CRUD, memberships, domain management
// - billing/      - Balance, auto-refill, payment methods
// - heuristics/   - Heuristic families and heuristics management
// =============================================================================

// Re-export the database client
export { default as prisma } from "./db.ts";

// Shared utilities
export * from "./shared/errors.ts";
export * from "./shared/helpers.ts";
export * from "./shared/authorization.ts";

// Storage services
export * from "./storage/s3Service.ts";

// Study services
export * from "./study/studyService.ts";
export * from "./study/cognitiveWalkthroughService.ts";
export * from "./study/heuristicEvaluationService.ts";
export * from "./study/personaService.ts";
export * from "./study/qualitativeAnalysisService.ts";
export * from "./study/liveSessionService.ts";
export * from "./study/interviewService.ts";
export * from "./study/takeawayService.ts";

// User services
export * from "./user/userService.ts";
export * from "./user/notificationService.ts";

// Team services
export * from "./team/teamService.ts";
export * from "./team/teamMembershipService.ts";
export * from "./team/teamJoinRequestService.ts";

// Company services
export * from "./company/companyService.ts";

// Billing services
export * from "./billing/balanceService.ts";
export * from "./billing/autoRefillService.ts";

// Heuristics services
export * from "./heuristics/heuristicFamilyService.ts";
export * from "./heuristics/heuristicService.ts";
