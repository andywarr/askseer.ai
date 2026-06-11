import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRealtimeSession } from "./interview-actions";

describe("createRealtimeSession - Localization mapping", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DB_WORKER_URL: "http://mock-worker.local",
      OPENAI_API_KEY: "mock-openai-key",
      INTERVIEW_REALTIME_MODEL: "gpt-realtime-2",
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should append English instructions for 'en' locale", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/study/interview/session/token")) {
        return {
          ok: true,
          json: async () => ({
            data: { session: { interview: { systemPrompt: "Base prompt." } } },
          }),
        } as Response;
      }
      if (typeof url === "string" && url.includes("/client_secrets")) {
        return {
          ok: true,
          json: async () => ({ value: "secret-en" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await createRealtimeSession("mock-session", "en");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toContain("Base prompt.");
      expect(result.data.systemPrompt).toContain(
        "CRITICAL: You MUST conduct the entire interview in English. Speak, listen, and respond exclusively in English."
      );
    }
  });

  it("should append Spanish instructions for 'es' locale", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/study/interview/session/token")) {
        return {
          ok: true,
          json: async () => ({
            data: { session: { interview: { systemPrompt: "Base prompt." } } },
          }),
        } as Response;
      }
      if (typeof url === "string" && url.includes("/client_secrets")) {
        return {
          ok: true,
          json: async () => ({ value: "secret-es" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await createRealtimeSession("mock-session", "es");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toContain(
        "CRITICAL: You MUST conduct the entire interview in Spanish. Speak, listen, and respond exclusively in Spanish."
      );
    }
  });

  it("should append German instructions for 'de' locale", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/study/interview/session/token")) {
        return {
          ok: true,
          json: async () => ({
            data: { session: { interview: { systemPrompt: "Base prompt." } } },
          }),
        } as Response;
      }
      if (typeof url === "string" && url.includes("/client_secrets")) {
        return {
          ok: true,
          json: async () => ({ value: "secret-de" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await createRealtimeSession("mock-session", "de");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toContain(
        "CRITICAL: You MUST conduct the entire interview in German. Speak, listen, and respond exclusively in German."
      );
    }
  });

  it("should dynamically resolve 'fr' to French instructions", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/study/interview/session/token")) {
        return {
          ok: true,
          json: async () => ({
            data: { session: { interview: { systemPrompt: "Base prompt." } } },
          }),
        } as Response;
      }
      if (typeof url === "string" && url.includes("/client_secrets")) {
        return {
          ok: true,
          json: async () => ({ value: "secret-fr" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await createRealtimeSession("mock-session", "fr");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toContain(
        "CRITICAL: You MUST conduct the entire interview in French. Speak, listen, and respond exclusively in French."
      );
    }
  });

  it("should fall back to English for unknown locales", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/study/interview/session/token")) {
        return {
          ok: true,
          json: async () => ({
            data: { session: { interview: { systemPrompt: "Base prompt." } } },
          }),
        } as Response;
      }
      if (typeof url === "string" && url.includes("/client_secrets")) {
        return {
          ok: true,
          json: async () => ({ value: "secret-xyz" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await createRealtimeSession("mock-session", "xyz");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toContain(
        "CRITICAL: You MUST conduct the entire interview in English. Speak, listen, and respond exclusively in English."
      );
    }
  });
});
