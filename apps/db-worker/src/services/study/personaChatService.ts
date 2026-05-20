import prisma from "@/apps/db-worker/src/services/db.ts";
import { PersonaChatRole } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
} from "../shared/authorization.ts";
import { ForbiddenError, NotFoundError } from "../shared/errors.ts";

// ============================================================================
// Authorization helpers
// ============================================================================

/**
 * Verify that userId has access to any study in the given personaGroupId.
 * Throws ForbiddenError if not.
 */
async function requirePersonaGroupAccess(
  personaGroupId: string,
  userId: string,
): Promise<void> {
  const { teamIds, companyIds, adminTeamIds, adminCompanyIds } =
    await getUserMembershipIds(userId);

  const visibilityConditions = buildStudyVisibilityConditions(
    userId,
    teamIds,
    companyIds,
    adminTeamIds,
    adminCompanyIds,
  );

  const accessibleStudy = await prisma.study.findFirst({
    where: {
      persona: { personaGroupId },
      ...(visibilityConditions.length > 0
        ? { OR: visibilityConditions }
        : { createdByUserId: userId }),
    },
    select: { id: true },
  });

  if (!accessibleStudy) {
    throw ForbiddenError(
      "You do not have access to this persona",
      "persona-access-denied",
    );
  }
}

// ============================================================================
// Chat history
// ============================================================================

export async function dbGetPersonaChat(personaGroupId: string, userId: string) {
  await requirePersonaGroupAccess(personaGroupId, userId);

  const chat = await prisma.personaChat.findUnique({
    where: { personaGroupId_userId: { personaGroupId, userId } },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  return chat;
}

export async function dbSavePersonaChatMessages(
  personaGroupId: string,
  userId: string,
  messages: Array<{ role: PersonaChatRole; content: string }>,
) {
  await requirePersonaGroupAccess(personaGroupId, userId);

  // Upsert the chat record, then add messages
  const chat = await prisma.personaChat.upsert({
    where: { personaGroupId_userId: { personaGroupId, userId } },
    create: { personaGroupId, userId },
    update: {},
    select: { id: true },
  });

  const created = await prisma.personaChatMessage.createMany({
    data: messages.map((m) => ({
      chatId: chat.id,
      role: m.role,
      content: m.content,
    })),
  });

  logger.debug("Saved persona chat messages", {
    personaGroupId,
    userId,
    count: created.count,
  });

  return { chatId: chat.id, count: created.count };
}

export async function dbClearPersonaChat(
  personaGroupId: string,
  userId: string,
) {
  await requirePersonaGroupAccess(personaGroupId, userId);

  const chat = await prisma.personaChat.findUnique({
    where: { personaGroupId_userId: { personaGroupId, userId } },
    select: { id: true },
  });

  if (!chat) return { deleted: 0 };

  const result = await prisma.personaChatMessage.deleteMany({
    where: { chatId: chat.id },
  });

  logger.debug("Cleared persona chat", {
    personaGroupId,
    userId,
    deleted: result.count,
  });

  return { deleted: result.count };
}

// ============================================================================
// FAQ items
// ============================================================================

export async function dbListPersonaFaqItems(
  personaGroupId: string,
  userId: string,
) {
  await requirePersonaGroupAccess(personaGroupId, userId);

  return prisma.personaFaqItem.findMany({
    where: { personaGroupId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function dbCreatePersonaFaqItem(
  personaGroupId: string,
  userId: string,
  question: string,
  answer: string,
) {
  await requirePersonaGroupAccess(personaGroupId, userId);

  const count = await prisma.personaFaqItem.count({
    where: { personaGroupId },
  });

  const item = await prisma.personaFaqItem.create({
    data: {
      personaGroupId,
      question: question.trim(),
      answer: answer.trim(),
      order: count,
      createdByUserId: userId,
    },
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info("Created persona FAQ item", {
    id: item.id,
    personaGroupId,
    userId,
  });

  return item;
}

export async function dbUpdatePersonaFaqItem(
  faqItemId: string,
  userId: string,
  question: string,
  answer: string,
) {
  const item = await prisma.personaFaqItem.findUnique({
    where: { id: faqItemId },
    select: { id: true, personaGroupId: true, createdByUserId: true },
  });

  if (!item) throw NotFoundError("FAQ item not found", "faq-not-found");

  await requireCanManageFaqItem(
    item.personaGroupId,
    item.createdByUserId,
    userId,
  );

  const updated = await prisma.personaFaqItem.update({
    where: { id: faqItemId },
    data: {
      question: question.trim(),
      answer: answer.trim(),
    },
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info("Updated persona FAQ item", { id: faqItemId, userId });
  return updated;
}

export async function dbDeletePersonaFaqItem(
  faqItemId: string,
  userId: string,
) {
  const item = await prisma.personaFaqItem.findUnique({
    where: { id: faqItemId },
    select: { id: true, personaGroupId: true, createdByUserId: true },
  });

  if (!item) throw NotFoundError("FAQ item not found", "faq-not-found");

  await requireCanManageFaqItem(
    item.personaGroupId,
    item.createdByUserId,
    userId,
  );

  await prisma.personaFaqItem.delete({ where: { id: faqItemId } });

  logger.info("Deleted persona FAQ item", { id: faqItemId, userId });
  return { deleted: true };
}

export async function dbReorderPersonaFaqItems(
  personaGroupId: string,
  userId: string,
  orderedIds: string[],
) {
  await requireCanManagePersonaGroup(personaGroupId, userId);

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.personaFaqItem.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  logger.info("Reordered persona FAQ items", {
    personaGroupId,
    userId,
    count: orderedIds.length,
  });
}

async function requireCanManagePersonaGroup(
  personaGroupId: string,
  requestingUserId: string,
): Promise<void> {
  const { adminTeamIds, adminCompanyIds } =
    await getUserMembershipIds(requestingUserId);

  const latestStudy = await prisma.study.findFirst({
    where: { persona: { personaGroupId, isLatest: true } },
    select: { teamId: true, team: { select: { companyId: true } } },
  });

  if (!latestStudy) {
    throw ForbiddenError("Persona not found", "persona-not-found");
  }

  const isTeamAdmin = adminTeamIds.includes(latestStudy.teamId);
  const isCompanyAdmin =
    latestStudy.team?.companyId != null &&
    adminCompanyIds.includes(latestStudy.team.companyId);

  if (!isTeamAdmin && !isCompanyAdmin) {
    throw ForbiddenError(
      "You do not have permission to manage this persona",
      "persona-manage-denied",
    );
  }
}

/**
 * Check if userId can manage (edit/delete) a FAQ item.
 * Allowed: the creator, team admin/owner of the persona's team, or company admin/owner.
 */
async function requireCanManageFaqItem(
  personaGroupId: string,
  createdByUserId: string,
  requestingUserId: string,
): Promise<void> {
  if (createdByUserId === requestingUserId) return;

  const { adminTeamIds, adminCompanyIds } =
    await getUserMembershipIds(requestingUserId);

  // Find the study team for this persona group
  const latestStudy = await prisma.study.findFirst({
    where: { persona: { personaGroupId, isLatest: true } },
    select: { teamId: true, team: { select: { companyId: true } } },
  });

  if (!latestStudy) {
    throw ForbiddenError("Persona not found", "persona-not-found");
  }

  const isTeamAdmin = adminTeamIds.includes(latestStudy.teamId);
  const isCompanyAdmin =
    latestStudy.team?.companyId != null &&
    adminCompanyIds.includes(latestStudy.team.companyId);

  if (!isTeamAdmin && !isCompanyAdmin) {
    throw ForbiddenError(
      "You do not have permission to manage this FAQ item",
      "faq-manage-denied",
    );
  }
}
