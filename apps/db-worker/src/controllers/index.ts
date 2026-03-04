/**
 * Database Controller Index
 *
 * This file re-exports all controller functions from their domain-specific modules.
 * The controller has been split into smaller, more maintainable files:
 *
 * - studyController.ts: Study CRUD, sharing, bookmarks, files
 * - companyController.ts: Company management, membership, invites
 * - teamController.ts: Team management, members, balance, auto-refill
 * - userController.ts: User profile, preferences, teams
 * - notificationController.ts: Notification CRUD
 * - heuristicController.ts: HE/CW evaluations, issues, recommendations, families
 * - personaController.ts: Persona CRUD and versioning
 * - utils.ts: Shared utilities (getParam, sendSuccess, handleServiceError, etc.)
 */

// Re-export all study-related controllers
export {
  deleteStudy,
  getStudies,
  getStudy,
  canAccessStudy,
  postStudyAttempts,
  postStudyStatus,
  updateStudyName,
  patchStudyTeam,
  patchStudyVisibility,
  postStudyRegenerateShareToken,
  postStudyToggleShareLink,
  getStudyByShareToken,
  getStudyShareInfo,
  getStudyPublicRedirectInfo,
  postStudyInit,
  postStudyFinalize,
  getBookmarkedStudies,
  postToggleStudyBookmark,
  getFiles,
  patchFileTranscript,
  patchFileIdentifier,
  postLiveSessionInit,
  getLiveSessionByToken,
  postLiveSessionTag,
  postLiveSessionNote,
  postLiveSessionRecordingFinalize,
  postBackroomMessage,
  getBackroomMessages,
  patchLiveSessionStatus,
  patchLiveSessionName,
  patchLiveSessionRecordingStarted,
  deleteLiveSession,
  getLiveSessionDetails,
  postLiveSessionTranscript,
} from "./studyController.ts";

// Re-export all company-related controllers
export {
  getCompanyByDomain,
  postCompanyCreateForDomain,
  postCompanyActivate,
  postCompanyReject,
  getCompanyMembers,
  getCompanyMembership,
  getCompanyTeams,
  patchCompanyName,
  patchCompanyLogo,
  patchCompanyJoin,
  patchCompanyPersonalTeams,
  getCompanyDomainUsers,
  postCompanyEnrollExisting,
  postCompanyMember,
  deleteCompanyMember,
  eraseCompanyUser,
  patchCompanyMember,
  deleteCompany,
  postCompanyInvite,
} from "./companyController.ts";

// Re-export all team-related controllers
export {
  getTeam,
  postTeam,
  patchTeamName,
  patchTeamJoin,
  patchTeamDescription,
  postTeamMembers,
  deleteTeamMember,
  patchTeamMemberRole,
  postTeamRequestJoin,
  getTeamJoinRequests,
  postAcceptTeamJoinRequest,
  postRejectTeamJoinRequest,
  postTeamBalanceAdjust,
  postTeamBalanceConsumeByStudy,
  postTeamBalanceRefundByStudy,
  getBalanceLedger,
  getTeamAutoRefillSettings,
  postTeamAutoRefillSettings,
  postTeamStripeCustomer,
  postTeamPaymentMethod,
  deleteTeamPaymentMethod,
  getTeamAutoRefillStatus,
} from "./teamController.ts";

// Re-export all user-related controllers
export {
  getUser,
  getUserTeams,
  updateUserName,
  updateUserImage,
  updateUserSelectedTeam,
  deleteUserAccount,
  getCommunicationPreferences,
  updateCommunicationPreferences,
} from "./userController.ts";

// Re-export all notification-related controllers
export {
  getNotifications,
  getNotificationsUnreadCount,
  postNotification,
  postNotificationMarkRead,
  postNotificationsMarkAllRead,
  deleteNotification,
} from "./notificationController.ts";

// Re-export all cognitive walkthrough controllers
export {
  getCWQuestion,
  getCognitiveWalkthrough,
  postCognitiveWalkthrough,
  updateCWIssue,
  updateCWRecommendation,
  deleteCWIssue,
  deleteCWRecommendation,
  createCWRecommendation,
  createCWIssue,
} from "./cognitiveWalkthroughController.ts";

// Re-export all heuristic evaluation controllers
export {
  getHeuristics,
  getHeuristicEvaluation,
  postHeuristicEvaluation,
  updateHEResult,
  updateHERecommendation,
  deleteHEResult,
  deleteHERecommendation,
  createHERecommendation,
  createHEResult,
} from "./heuristicEvaluationController.ts";

// Re-export all heuristic management controllers
export {
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
} from "./heuristicManagementController.ts";

// Re-export all persona-related controllers
export {
  getPersona,
  getPersonaBasicInfo,
  getPersonas,
  getCompanyPersonas,
  getPersonaVersions,
  updatePersona,
  postPersona,
} from "./personaController.ts";

// Re-export all qualitative analysis controllers
export {
  getQualitativeAnalysis,
  postQualitativeAnalysis,
  patchQualitativeAnalysisSummary,
  patchAnalysisInsight,
  deleteAnalysisQuote,
  postAnalysisTag,
  deleteAnalysisTag,
  deleteAnalysisInsight,
  postAnalysisQuote,
  postAnalysisInsight,
} from "./qualitativeAnalysisController.ts";

// Re-export utility functions for use in routes or middleware
export {
  getParam,
  requireParam,
  normalizeRating,
  validateRating,
  handleServiceError,
  convertToStudyStatus,
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
  requireCompanyAdmin,
} from "./utils.ts";
