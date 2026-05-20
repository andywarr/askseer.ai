/**
 * Persona chat and FAQ controller handlers.
 */

import {
  requireParam,
  sendSuccess,
  sendError,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetPersonaChat,
  dbSavePersonaChatMessages,
  dbClearPersonaChat,
  dbListPersonaFaqItems,
  dbListPublicPersonaFaqItems,
  dbCreatePersonaFaqItem,
  dbUpdatePersonaFaqItem,
  dbDeletePersonaFaqItem,
  dbReorderPersonaFaqItems,
} from "@/apps/db-worker/src/services/index.ts";
import { PersonaChatRole } from "@prisma/client";

// ============================================================================
// Chat
// ============================================================================

export const getPersonaChat = withErrorHandler(async (req, res) => {
  const personaGroupId = requireParam(
    req,
    res,
    "personaGroupId",
    "Persona group ID",
    "persona-group-id",
  );
  if (!personaGroupId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetPersonaChat(personaGroupId, userId);
  sendSuccess(res, data ?? { messages: [] });
}, "GET /persona-chat");

export const postPersonaChatMessages = withErrorHandler(async (req, res) => {
  const { personaGroupId, userId, messages } = req.body ?? {};

  if (!personaGroupId) return sendError(res, "personaGroupId is required");
  if (!userId) return sendError(res, "userId is required");
  if (!Array.isArray(messages) || messages.length === 0)
    return sendError(res, "messages array is required");

  // Validate message structure
  for (const m of messages) {
    if (!m.role || !m.content) {
      return sendError(res, "Each message must have role and content");
    }
    if (
      m.role !== PersonaChatRole.USER &&
      m.role !== PersonaChatRole.ASSISTANT
    ) {
      return sendError(res, `Invalid role: ${m.role}`);
    }
  }

  const data = await dbSavePersonaChatMessages(
    personaGroupId,
    userId,
    messages,
  );
  sendSuccess(res, data);
}, "POST /persona-chat");

export const deletePersonaChat = withErrorHandler(async (req, res) => {
  const personaGroupId = requireParam(
    req,
    res,
    "personaGroupId",
    "Persona group ID",
    "persona-group-id",
  );
  if (!personaGroupId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbClearPersonaChat(personaGroupId, userId);
  sendSuccess(res, data);
}, "DELETE /persona-chat");

// ============================================================================
// FAQ
// ============================================================================

export const getPersonaFaqItems = withErrorHandler(async (req, res) => {
  const personaGroupId = requireParam(
    req,
    res,
    "personaGroupId",
    "Persona group ID",
    "persona-group-id",
  );
  if (!personaGroupId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbListPersonaFaqItems(personaGroupId, userId);
  sendSuccess(res, data);
}, "GET /persona-faq");

export const getPublicPersonaFaqItems = withErrorHandler(async (req, res) => {
  const personaGroupId = requireParam(
    req,
    res,
    "personaGroupId",
    "Persona group ID",
    "persona-group-id",
  );
  if (!personaGroupId) return;

  const shareToken = requireParam(
    req,
    res,
    "shareToken",
    "Share token",
    "share-token",
  );
  if (!shareToken) return;

  const data = await dbListPublicPersonaFaqItems(personaGroupId, shareToken);
  sendSuccess(res, data);
}, "GET /persona-faq/public");

export const postPersonaFaqItem = withErrorHandler(async (req, res) => {
  const { personaGroupId, userId, question, answer } = req.body ?? {};

  if (!personaGroupId) return sendError(res, "personaGroupId is required");
  if (!userId) return sendError(res, "userId is required");
  if (!question?.trim()) return sendError(res, "question is required");
  if (!answer?.trim()) return sendError(res, "answer is required");

  const data = await dbCreatePersonaFaqItem(
    personaGroupId,
    userId,
    question,
    answer,
  );
  sendSuccess(res, data);
}, "POST /persona-faq");

export const patchPersonaFaqItem = withErrorHandler(async (req, res) => {
  const faqItemId = requireParam(
    req,
    res,
    "faqItemId",
    "FAQ item ID",
    "faq-item-id",
  );
  if (!faqItemId) return;

  const { userId, question, answer } = req.body ?? {};

  if (!userId) return sendError(res, "userId is required");
  if (!question?.trim()) return sendError(res, "question is required");
  if (!answer?.trim()) return sendError(res, "answer is required");

  const data = await dbUpdatePersonaFaqItem(
    faqItemId,
    userId,
    question,
    answer,
  );
  sendSuccess(res, data);
}, "PATCH /persona-faq/:id");

export const deletePersonaFaqItem = withErrorHandler(async (req, res) => {
  const faqItemId =
    req.params.id ??
    requireParam(req, res, "faqItemId", "FAQ item ID", "faq-item-id");
  if (!faqItemId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbDeletePersonaFaqItem(faqItemId, userId);
  sendSuccess(res, data);
}, "DELETE /persona-faq/:id");

export const putPersonaFaqOrder = withErrorHandler(async (req, res) => {
  const { personaGroupId, userId, orderedIds } = req.body ?? {};

  if (!personaGroupId) return sendError(res, "personaGroupId is required");
  if (!userId) return sendError(res, "userId is required");
  if (!Array.isArray(orderedIds) || orderedIds.length === 0)
    return sendError(res, "orderedIds array is required");

  await dbReorderPersonaFaqItems(personaGroupId, userId, orderedIds);
  sendSuccess(res, { reordered: true });
}, "PUT /persona-faq/reorder");
