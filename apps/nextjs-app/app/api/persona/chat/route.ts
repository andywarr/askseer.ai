import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.PERSONA_CHAT_MODEL ?? "gpt-5-mini-2025-08-07";
// Max previous messages to include for context (pairs of user+assistant)
const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { personaGroupId: string; studyId: string; message: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { personaGroupId, studyId, message } = body;
  if (!personaGroupId || !studyId || !message?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const dbWorkerUrl = process.env.DB_WORKER_URL;
  if (!dbWorkerUrl) {
    logger.error("DB_WORKER_URL is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Fetch persona data and existing chat history in parallel
  const [personaRes, chatHistoryRes] = await Promise.all([
    fetch(
      `${dbWorkerUrl}/api/persona?studyId=${encodeURIComponent(studyId)}&userId=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      },
    ),
    fetch(
      `${dbWorkerUrl}/api/persona/chat?personaGroupId=${encodeURIComponent(personaGroupId)}&userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    ),
  ]);

  let personaData: any = null;
  if (personaRes.ok) {
    const json = await personaRes.json();
    personaData =
      json.data?.persona?.data?.data ?? json.data?.persona?.data ?? null;
  }

  let chatHistory: Array<{ role: "USER" | "ASSISTANT"; content: string }> = [];
  if (chatHistoryRes.ok) {
    const json = await chatHistoryRes.json();
    chatHistory = json.data?.messages ?? [];
  }

  // Build system prompt from persona data
  const systemPrompt = buildSystemPrompt(personaData);

  // Convert DB history to OpenAI message format (limit to recent messages)
  const recentHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
  const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
    recentHistory.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));

  // Stream the response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let assistantContent = "";

      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: message.trim() },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            assistantContent += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }

        controller.close();
      } catch (err) {
        logger.error("Error streaming persona chat response", {
          userId,
          personaGroupId,
          err,
        });
        controller.error(err);
        return;
      }

      // After stream completes, save both messages to db-worker (fire-and-forget)
      const messages = [
        { role: "USER", content: message.trim() },
        { role: "ASSISTANT", content: assistantContent },
      ];
      fetch(`${dbWorkerUrl}/api/persona/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaGroupId, userId, messages }),
      }).catch((err) => {
        logger.error("Failed to save persona chat messages", {
          userId,
          personaGroupId,
          err,
        });
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function buildSystemPrompt(persona: any): string {
  if (!persona) {
    return "You are a synthetic user persona. Respond in character as a realistic user, answering questions from your personal perspective.";
  }

  const parts: string[] = [];

  const name = persona.name ?? "User";
  parts.push(
    `You are ${name}, a synthetic user persona. Respond in first person, in character as ${name}.`,
  );
  parts.push(
    "Answer questions from your personal perspective, as a real user would. Be authentic to the persona's characteristics.",
  );

  if (persona.description) {
    parts.push(`\nAbout you: ${persona.description}`);
  }

  const demo = persona.demographics;
  if (demo) {
    const demoItems = [
      demo.age && `Age: ${demo.age}`,
      demo.gender && `Gender: ${demo.gender}`,
      demo.location && `Location: ${demo.location}`,
      demo.education && `Education: ${demo.education}`,
      demo.income && `Income: ${demo.income}`,
      demo.maritalStatus && `Marital status: ${demo.maritalStatus}`,
    ].filter(Boolean);
    if (demoItems.length > 0) {
      parts.push(`\nDemographics:\n${demoItems.join("\n")}`);
    }
  }

  const psycho = persona.psychographics;
  if (psycho) {
    const psychoItems = [
      psycho.values &&
        `Values: ${Array.isArray(psycho.values) ? psycho.values.join(", ") : psycho.values}`,
      psycho.personality && `Personality: ${psycho.personality}`,
      psycho.lifestyle && `Lifestyle: ${psycho.lifestyle}`,
      psycho.motivations &&
        `Motivations: ${Array.isArray(psycho.motivations) ? psycho.motivations.join(", ") : psycho.motivations}`,
      psycho.frustrations &&
        `Frustrations: ${Array.isArray(psycho.frustrations) ? psycho.frustrations.join(", ") : psycho.frustrations}`,
    ].filter(Boolean);
    if (psychoItems.length > 0) {
      parts.push(`\nPsychographics:\n${psychoItems.join("\n")}`);
    }
  }

  if (Array.isArray(persona.goals) && persona.goals.length > 0) {
    const goalStrings = persona.goals
      .map((g: any) => {
        if (typeof g === "string") return g;
        if (g?.want && g?.soThat) return `${g.want} — so that ${g.soThat}`;
        return g?.want ?? g?.soThat ?? "";
      })
      .filter(Boolean);
    if (goalStrings.length > 0) {
      parts.push(
        `\nGoals:\n${goalStrings.map((g: string) => `- ${g}`).join("\n")}`,
      );
    }
  }

  if (Array.isArray(persona.quotes) && persona.quotes.length > 0) {
    const quoteStrings = persona.quotes.filter(
      (q: any) => typeof q === "string" && q.trim(),
    );
    if (quoteStrings.length > 0) {
      parts.push(
        `\nThings you might say:\n${quoteStrings.map((q: string) => `"${q}"`).join("\n")}`,
      );
    }
  }

  parts.push(
    "\nRespond naturally and conversationally, staying true to this persona. Do not break character or reveal that you are an AI. Answer only what was asked — do not end responses with follow-up questions, offers to elaborate, or prompts for further engagement.",
  );

  return parts.join("\n");
}
