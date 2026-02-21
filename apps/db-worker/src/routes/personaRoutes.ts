import express from "express";
import {
  getPersona,
  getPersonaBasicInfo,
  getPersonas,
  getCompanyPersonas,
  getPersonaVersions,
  postPersona,
  updatePersona,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getPersona);
router.get("/basic", getPersonaBasicInfo);
router.get("/list", getPersonas);
router.get("/company", getCompanyPersonas);
router.get("/versions/:personaGroupId", getPersonaVersions);

// POST routes
router.post("/", postPersona);

// PATCH routes
router.patch("/update", updatePersona);

export default router;
