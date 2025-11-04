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
  getCWQuestion,
  getCognitiveWalkthrough,
  getFiles,
  getHeuristics,
  getHeuristicEvaluation,
  getPersona,
  getPersonas,
  getPersonaVersions,
  updatePersona,
  updatePersonaCompanyVisibility,
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
  postTeamMembers,
  postTeamCreditsAdjust,
  postTeamCreditsConsumeByStudy,
  postTeamCreditsRefundByStudy,
  getCompanyByDomain,
  postCompanyCreateForDomain,
  getCompanyMembers,
  getCompanyTeams,
  postCompanyMember,
  postCompanyInvite,
  patchCompanyName,
  patchCompanyLogo,
  patchCompanyJoin,
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
router.delete("/company/members", deleteCompanyMember);

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
router.get("/user", getUser);
router.get("/user/teams", getUserTeams);
router.get("/communicationPreferences", getCommunicationPreferences);
router.get("/team", getTeam);
router.get("/company/by-domain", getCompanyByDomain);
router.get("/company/members", getCompanyMembers);
router.get("/company/domain-users", getCompanyDomainUsers);
router.get("/company/teams", getCompanyTeams);

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
router.post("/team", postTeam);
router.post("/team/members", postTeamMembers);
router.post("/team/credits/adjust", postTeamCreditsAdjust);
router.post("/team/credits/consume", postTeamCreditsConsumeByStudy);
router.post("/team/credits/refund", postTeamCreditsRefundByStudy);
router.post("/company/create-for-domain", postCompanyCreateForDomain);
router.post("/company/members", postCompanyMember);
router.post("/company/invite", postCompanyInvite);
router.post("/company/enroll", postCompanyEnrollExisting);

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
router.patch("/team/name", patchTeamName);
router.patch("/user/name", updateUserName);
router.patch("/user/image", updateUserImage);
router.patch("/user/selected-team", updateUserSelectedTeam);
router.patch("/communicationPreferences", updateCommunicationPreferences);
router.patch("/persona/update", updatePersona);
router.patch(
  "/persona/company-visibility",
  updatePersonaCompanyVisibility,
);
router.patch("/company/name", patchCompanyName);
router.patch("/company/logo", patchCompanyLogo);
router.patch("/company/join", patchCompanyJoin);

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

export default router;
