"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/apps/shared/logger";
import {
  requireAuth,
  actionSuccess,
  actionError,
  type ActionResult,
} from "@/apps/nextjs-app/lib/actions/shared";

const dbWorkerUrl = () => {
  const url = process.env.DB_WORKER_URL;
  if (!url) throw new Error("DB_WORKER_URL is not configured");
  return url;
};

// ==========================================
// Types
// ==========================================

export interface PersonaChatMessage {
  id: string;
  chatId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export interface PersonaFaqItem {
  id: string;
  personaGroupId: string;
  question: string;
  answer: string;
  order: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Chat actions
// ==========================================

export async function getPersonaChatHistory(
  personaGroupId: string,
): Promise<ActionResult<PersonaChatMessage[]>> {
  try {
    const user = await requireAuth();
    const params = new URLSearchParams({ personaGroupId, userId: user.id });
    const res = await fetch(
      `${dbWorkerUrl()}/api/persona/chat?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to load chat history");
    }
    const { data } = await res.json();
    return actionSuccess(data?.messages ?? []);
  } catch (err) {
    logger.error("getPersonaChatHistory failed", { personaGroupId, err });
    return actionError("Failed to load chat history");
  }
}

export async function clearPersonaChat(
  personaGroupId: string,
  personaStudyId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireAuth();
    const res = await fetch(`${dbWorkerUrl()}/api/persona/chat`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaGroupId, userId: user.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to clear chat");
    }
    revalidatePath(`/persona/${personaStudyId}`);
    return actionSuccess(undefined);
  } catch (err) {
    logger.error("clearPersonaChat failed", { personaGroupId, err });
    return actionError("Failed to clear chat");
  }
}

// ==========================================
// FAQ actions
// ==========================================

export async function getPersonaFaqItemsPublic(
  personaGroupId: string,
  shareToken: string,
): Promise<PersonaFaqItem[]> {
  try {
    const params = new URLSearchParams({ personaGroupId, shareToken });
    const res = await fetch(
      `${dbWorkerUrl()}/api/persona/faq/public?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const { data } = await res.json();
    return data ?? [];
  } catch (err) {
    logger.error("getPersonaFaqItemsPublic failed", { personaGroupId, err });
    return [];
  }
}

export async function getPersonaFaqItems(
  personaGroupId: string,
): Promise<ActionResult<PersonaFaqItem[]>> {
  try {
    const user = await requireAuth();
    const params = new URLSearchParams({ personaGroupId, userId: user.id });
    const res = await fetch(
      `${dbWorkerUrl()}/api/persona/faq?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to load FAQ items");
    }
    const { data } = await res.json();
    return actionSuccess(data ?? []);
  } catch (err) {
    logger.error("getPersonaFaqItems failed", { personaGroupId, err });
    return actionError("Failed to load FAQ items");
  }
}

export async function createPersonaFaqItem(
  personaGroupId: string,
  question: string,
  answer: string,
  personaStudyId: string,
): Promise<ActionResult<PersonaFaqItem>> {
  try {
    const user = await requireAuth();
    const res = await fetch(`${dbWorkerUrl()}/api/persona/faq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaGroupId,
        userId: user.id,
        question,
        answer,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to create FAQ item");
    }
    const { data } = await res.json();
    revalidatePath(`/persona/${personaStudyId}`);
    return actionSuccess(data);
  } catch (err) {
    logger.error("createPersonaFaqItem failed", { personaGroupId, err });
    return actionError("Failed to create FAQ item");
  }
}

export async function updatePersonaFaqItem(
  faqItemId: string,
  question: string,
  answer: string,
  personaStudyId: string,
): Promise<ActionResult<PersonaFaqItem>> {
  try {
    const user = await requireAuth();
    const res = await fetch(`${dbWorkerUrl()}/api/persona/faq/${faqItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, question, answer }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to update FAQ item");
    }
    const { data } = await res.json();
    revalidatePath(`/persona/${personaStudyId}`);
    return actionSuccess(data);
  } catch (err) {
    logger.error("updatePersonaFaqItem failed", { faqItemId, err });
    return actionError("Failed to update FAQ item");
  }
}

export async function deletePersonaFaqItem(
  faqItemId: string,
  personaStudyId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireAuth();
    const res = await fetch(`${dbWorkerUrl()}/api/persona/faq/${faqItemId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to delete FAQ item");
    }
    revalidatePath(`/persona/${personaStudyId}`);
    return actionSuccess(undefined);
  } catch (err) {
    logger.error("deletePersonaFaqItem failed", { faqItemId, err });
    return actionError("Failed to delete FAQ item");
  }
}

export async function reorderPersonaFaqItems(
  personaGroupId: string,
  orderedIds: string[],
  personaStudyId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireAuth();
    const res = await fetch(`${dbWorkerUrl()}/api/persona/faq/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaGroupId, userId: user.id, orderedIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return actionError(body.message ?? "Failed to reorder FAQ items");
    }
    revalidatePath(`/persona/${personaStudyId}`);
    return actionSuccess(undefined);
  } catch (err) {
    logger.error("reorderPersonaFaqItems failed", { personaGroupId, err });
    return actionError("Failed to reorder FAQ items");
  }
}
