// Express imports
import express from "express";

// Function imports
import {
  deleteStudy,
  deleteCWIssue,
  deleteCWRecommendation,
  deleteHEResult,
  deleteHERecommendation,
  deleteCompanyMember,
  deleteCompany,
  deleteTeamMember,
  eraseCompanyUser,
  deleteUserAccount,
  patchCompanyMember,
  getCWQuestion,
  getCognitiveWalkthrough,
  getFiles,
  getHeuristics,
  getHeuristicEvaluation,
  getPersona,
  getPersonas,
  getPersonaVersions,
  updatePersona,
  getStudies,
  getStudy,
  getUser,
  getUserTeams,
  postCognitiveWalkthrough,
  postHeuristicEvaluation,
  postStudyAttempts,
  postStudyStatus,
  updateCWIssue,
  updateCWRecommendation,
  updateHEResult,
  updateHERecommendation,
  updateStudyName,
  patchStudyTeam,
  patchStudyVisibility,
  postStudyRegenerateShareToken,
  getStudyByShareToken,
  getStudyShareInfo,
  getStudyPublicRedirectInfo,
  createCWRecommendation,
  createHERecommendation,
  createHEResult,
  createCWIssue,
  updateUserName,
  updateUserImage,
  updateUserSelectedTeam,
  postStudyInit,
  postStudyFinalize,
  getCommunicationPreferences,
  updateCommunicationPreferences,
  postPersona,
  getTeam,
  postTeam,
  patchTeamName,
  patchTeamDescription,
  patchTeamJoin,
  postTeamMembers,
  patchTeamMemberRole,
  postTeamCreditsAdjust,
  postTeamCreditsConsumeByStudy,
  postTeamCreditsRefundByStudy,
  getCompanyByDomain,
  postCompanyCreateForDomain,
  getCompanyMembers,
  getCompanyMembership,
  getCompanyTeams,
  postCompanyMember,
  postCompanyInvite,
  patchCompanyName,
  patchCompanyLogo,
  patchCompanyJoin,
  patchCompanyPersonalTeams,
  getCompanyDomainUsers,
  postCompanyEnrollExisting,
  getHeuristicFamilies,
  getHeuristicFamily,
  createHeuristicFamily,
  updateHeuristicFamily,
  deleteHeuristicFamily,
  toggleHeuristicFamilyVisibility,
  getHeuristic,
  createHeuristic,
  updateHeuristic,
  deleteHeuristic,
  createHeuristicExample,
  updateHeuristicExample,
  deleteHeuristicExample,
  postTeamRequestJoin,
  getTeamJoinRequests,
  postAcceptTeamJoinRequest,
  postRejectTeamJoinRequest,
  getCreditLedger,
  getStarredStudies,
  postToggleStudyStar,
  getTeamAutoRefillSettings,
  postTeamAutoRefillSettings,
  postTeamStripeCustomer,
  postTeamPaymentMethod,
  deleteTeamPaymentMethod,
  getTeamAutoRefillStatus,
} from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// Delete routes
router.delete("/study", deleteStudy);
router.delete("/cognitiveWalkthrough/issues/:id", deleteCWIssue);
router.delete(
  "/cognitiveWalkthrough/recommendations/:id",
  deleteCWRecommendation
);
router.delete("/heuristicEvaluation/issues/:id", deleteHEResult);
router.delete(
  "/heuristicEvaluation/recommendations/:id",
  deleteHERecommendation
);
router.delete("/company", deleteCompany);
router.delete("/company/members", deleteCompanyMember);
router.post("/company/members/erase", eraseCompanyUser);
router.delete("/user", deleteUserAccount);

// Get routes
router.get("/cognitiveWalkthrough", getCognitiveWalkthrough);
router.get("/cwquestions", getCWQuestion);
router.get("/files", getFiles);
router.get("/heuristics", getHeuristics);
router.get("/heuristicEvaluation", getHeuristicEvaluation);
router.get("/persona", getPersona);
router.get("/personas", getPersonas);
router.get("/persona/versions/:personaGroupId", getPersonaVersions);
router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/study/shared", getStudyByShareToken);
router.get("/study/share-info", getStudyShareInfo);
router.get("/study/public-redirect", getStudyPublicRedirectInfo);
router.get("/starred-studies", getStarredStudies);
router.get("/user", getUser);
router.get("/user/teams", getUserTeams);
router.get("/communicationPreferences", getCommunicationPreferences);
router.get("/team", getTeam);
router.get("/team/join-requests", getTeamJoinRequests);
router.get("/company/by-domain", getCompanyByDomain);
router.get("/company/members", getCompanyMembers);
router.get("/company/membership", getCompanyMembership);
router.get("/company/domain-users", getCompanyDomainUsers);
router.get("/company/teams", getCompanyTeams);
router.get("/credit-ledger", getCreditLedger);

// Post routes
router.post("/cognitiveWalkthrough", postCognitiveWalkthrough);
router.post("/heuristicEvaluation", postHeuristicEvaluation);
router.post("/studyAttempts", postStudyAttempts);
router.post("/studyStatus", postStudyStatus);
router.post("/persona", postPersona);
router.post("/cognitiveWalkthrough/recommendations", createCWRecommendation);
router.post("/cognitiveWalkthrough/issues", createCWIssue);
router.post("/heuristicEvaluation/recommendations", createHERecommendation);
router.post("/heuristicEvaluation/results", createHEResult);
router.post("/study/init", postStudyInit);
router.post("/study/finalize", postStudyFinalize);
router.post("/study/toggle-star", postToggleStudyStar);
router.post("/team", postTeam);
router.post("/team/members", postTeamMembers);
router.patch("/team/members/role", patchTeamMemberRole);
router.post("/team/request-join", postTeamRequestJoin);
router.post("/team/join-requests/accept", postAcceptTeamJoinRequest);
router.post("/team/join-requests/reject", postRejectTeamJoinRequest);
router.post("/team/credits/adjust", postTeamCreditsAdjust);
router.post("/team/credits/consume", postTeamCreditsConsumeByStudy);
router.post("/team/credits/refund", postTeamCreditsRefundByStudy);
router.post("/company/create-for-domain", postCompanyCreateForDomain);
router.post("/company/members", postCompanyMember);
router.post("/company/invite", postCompanyInvite);
router.post("/company/enroll", postCompanyEnrollExisting);
router.delete("/team/members", deleteTeamMember);

// Patch routes
router.patch("/cognitiveWalkthrough/issues/:id", updateCWIssue);
router.patch(
  "/cognitiveWalkthrough/recommendations/:id",
  updateCWRecommendation
);
router.patch("/heuristicEvaluation/issues/:id", updateHEResult);
router.patch(
  "/heuristicEvaluation/recommendations/:id",
  updateHERecommendation
);
router.patch("/study/name", updateStudyName);
router.patch("/study/team", patchStudyTeam);
router.patch("/study/visibility", patchStudyVisibility);
router.post("/study/regenerate-share-token", postStudyRegenerateShareToken);
router.patch("/team/name", patchTeamName);
router.patch("/team/description", patchTeamDescription);
router.patch("/team/join", patchTeamJoin);
router.patch("/user/name", updateUserName);
router.patch("/user/image", updateUserImage);
router.patch("/user/selected-team", updateUserSelectedTeam);
router.patch("/communicationPreferences", updateCommunicationPreferences);
router.patch("/persona/update", updatePersona);
router.patch("/company/name", patchCompanyName);
router.patch("/company/logo", patchCompanyLogo);
router.patch("/company/join", patchCompanyJoin);
router.patch("/company/personal-teams", patchCompanyPersonalTeams);
router.patch("/company/members", patchCompanyMember);

// Heuristic Family Management routes
router.get("/heuristic-families", getHeuristicFamilies);
router.get("/heuristic-families/:id", getHeuristicFamily);
router.post("/heuristic-families", createHeuristicFamily);
router.patch("/heuristic-families/:id", updateHeuristicFamily);
router.delete("/heuristic-families/:id", deleteHeuristicFamily);
router.post(
  "/heuristic-families/:id/visibility",
  toggleHeuristicFamilyVisibility
);

// Heuristic Management routes
router.get("/heuristics/:id", getHeuristic);
router.post("/heuristics", createHeuristic);
router.patch("/heuristics/:id", updateHeuristic);
router.delete("/heuristics/:id", deleteHeuristic);

// Heuristic Example Management routes
router.post("/heuristic-examples", createHeuristicExample);
router.patch("/heuristic-examples/:id", updateHeuristicExample);
router.delete("/heuristic-examples/:id", deleteHeuristicExample);

// Auto-refill routes
router.get("/team/auto-refill", getTeamAutoRefillSettings);
router.post("/team/auto-refill", postTeamAutoRefillSettings);
router.get("/team/auto-refill/status", getTeamAutoRefillStatus);
router.post("/team/stripe-customer", postTeamStripeCustomer);
router.post("/team/payment-method", postTeamPaymentMethod);
router.delete("/team/payment-method", deleteTeamPaymentMethod);

export default router;
