import express from "express";
import {
  getPersonaChat,
  postPersonaChatMessages,
  deletePersonaChat,
  getPersonaFaqItems,
  postPersonaFaqItem,
  patchPersonaFaqItem,
  deletePersonaFaqItem,
  putPersonaFaqOrder,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// Chat routes
router.get("/chat", getPersonaChat);
router.post("/chat", postPersonaChatMessages);
router.delete("/chat", deletePersonaChat);

// FAQ routes
router.get("/faq", getPersonaFaqItems);
router.post("/faq", postPersonaFaqItem);
router.put("/faq/reorder", putPersonaFaqOrder);
router.patch("/faq/:id", patchPersonaFaqItem);
router.delete("/faq/:id", deletePersonaFaqItem);

export default router;
