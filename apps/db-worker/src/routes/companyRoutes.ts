import express from "express";
import {
  deleteCompanyMember,
  deleteCompany,
  eraseCompanyUser,
  patchCompanyMember,
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
  postCompanyActivate,
  postCompanyReject,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/by-domain", getCompanyByDomain);
router.get("/members", getCompanyMembers);
router.get("/membership", getCompanyMembership);
router.get("/domain-users", getCompanyDomainUsers);
router.get("/teams", getCompanyTeams);

// POST routes
router.post("/create-for-domain", postCompanyCreateForDomain);
router.post("/members", postCompanyMember);
router.post("/members/erase", eraseCompanyUser);
router.post("/invite", postCompanyInvite);
router.post("/enroll", postCompanyEnrollExisting);
router.post("/activate", postCompanyActivate);
router.post("/reject", postCompanyReject);

// PATCH routes
router.patch("/name", patchCompanyName);
router.patch("/logo", patchCompanyLogo);
router.patch("/join", patchCompanyJoin);
router.patch("/personal-teams", patchCompanyPersonalTeams);
router.patch("/members", patchCompanyMember);

// DELETE routes
router.delete("/", deleteCompany);
router.delete("/members", deleteCompanyMember);

export default router;
