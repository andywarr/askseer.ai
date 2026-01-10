import express from "express";
import {
  deleteTeamMember,
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
  postTeamRequestJoin,
  getTeamJoinRequests,
  postAcceptTeamJoinRequest,
  postRejectTeamJoinRequest,
  getCreditLedger,
  getTeamAutoRefillSettings,
  postTeamAutoRefillSettings,
  postTeamStripeCustomer,
  postTeamPaymentMethod,
  deleteTeamPaymentMethod,
  getTeamAutoRefillStatus,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getTeam);
router.get("/join-requests", getTeamJoinRequests);
router.get("/credit-ledger", getCreditLedger);
router.get("/auto-refill", getTeamAutoRefillSettings);
router.get("/auto-refill/status", getTeamAutoRefillStatus);

// POST routes
router.post("/", postTeam);
router.post("/members", postTeamMembers);
router.post("/request-join", postTeamRequestJoin);
router.post("/join-requests/accept", postAcceptTeamJoinRequest);
router.post("/join-requests/reject", postRejectTeamJoinRequest);
router.post("/credits/adjust", postTeamCreditsAdjust);
router.post("/credits/consume", postTeamCreditsConsumeByStudy);
router.post("/credits/refund", postTeamCreditsRefundByStudy);
router.post("/auto-refill", postTeamAutoRefillSettings);
router.post("/stripe-customer", postTeamStripeCustomer);
router.post("/payment-method", postTeamPaymentMethod);

// PATCH routes
router.patch("/name", patchTeamName);
router.patch("/description", patchTeamDescription);
router.patch("/join", patchTeamJoin);
router.patch("/members/role", patchTeamMemberRole);

// DELETE routes
router.delete("/members", deleteTeamMember);
router.delete("/payment-method", deleteTeamPaymentMethod);

export default router;
