import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { translateText, translateMessages } from "./translate-actions";
import { requireAuth } from "@/apps/nextjs-app/lib/actions/shared";
import OpenAI from "openai";

vi.mock("@/apps/nextjs-app/lib/actions/shared", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      id: "test-user-id",
      email: "test@example.com",
    }),
  ),
  actionSuccess: <T>(data: T) => ({ success: true, data }),
  actionError: (error: string) => ({ success: false, error }),
}));

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  const mockResponsesCreate = vi.fn();
  class MockOpenAI {
    static mockCreate = mockCreate;
    static mockResponsesCreate = mockResponsesCreate;
    chat = {
      completions: {
        create: mockCreate,
      },
    };
    responses = {
      create: mockResponsesCreate,
    };
  }
  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

describe("translateText Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
    });
    ((OpenAI as any).mockCreate as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: "Hello, translated",
          },
        },
      ],
    });
  });

  it("should check auth and return empty translation if input text is empty", async () => {
    const result = await translateText("", "es");

    expect(requireAuth).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.translatedText).toBe("");
    }
    expect(((OpenAI as any).mockCreate as Mock)).not.toHaveBeenCalled();
  });

  it("should call OpenAI chat completions with correct parameters and prompt", async () => {
    const result = await translateText("Hola amigo", "en");

    expect(requireAuth).toHaveBeenCalled();
    expect(((OpenAI as any).mockCreate as Mock)).toHaveBeenCalled();
    const callArgs = ((OpenAI as any).mockCreate as Mock).mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.messages[0].content).toContain("translate the user's text into the target language: English");
    expect(callArgs.messages[1].content).toBe("Hola amigo");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.translatedText).toBe("Hello, translated");
    }
  });

  it("should fall back to source text if completion response message content is empty", async () => {
    ((OpenAI as any).mockCreate as Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });

    const result = await translateText("Hola amigo", "de");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.translatedText).toBe("Hola amigo");
    }
  });

  it("should handle requireAuth throws error and return failure", async () => {
    (requireAuth as Mock).mockRejectedValue(new Error("Unauthorized"));

    const result = await translateText("Hola amigo", "en");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });

  it("should handle OpenAI completion throwing and return actionError", async () => {
    ((OpenAI as any).mockCreate as Mock).mockRejectedValue(new Error("OpenAI API limit reached"));

    const result = await translateText("Hola amigo", "es");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("OpenAI API limit reached");
    }
  });
});

describe("translateMessages Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
    });
    ((OpenAI as any).mockResponsesCreate as Mock).mockResolvedValue({
      output_text: JSON.stringify({
        translations: [
          { id: "msg-1", text: "Hello, translated 1" },
          { id: "msg-2", text: "Hello, translated 2" },
        ],
      }),
    });
  });

  it("should return empty array if messages are empty", async () => {
    const result = await translateMessages([], "es");

    expect(requireAuth).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
    expect((OpenAI as any).mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("should call OpenAI responses with correct parameters and map results", async () => {
    const input = [
      { id: "msg-1", text: "Hola 1" },
      { id: "msg-2", text: "Hola 2" },
    ];
    const result = await translateMessages(input, "en");

    expect(requireAuth).toHaveBeenCalled();
    expect((OpenAI as any).mockResponsesCreate).toHaveBeenCalled();
    const callArgs = ((OpenAI as any).mockResponsesCreate as Mock).mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.input[0].content).toContain("translate the provided messages into English");
    expect(callArgs.input[1].content).toBe(JSON.stringify(input));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        { id: "msg-1", translatedText: "Hello, translated 1" },
        { id: "msg-2", translatedText: "Hello, translated 2" },
      ]);
    }
  });

  it("should return error if OpenAI response is empty", async () => {
    ((OpenAI as any).mockResponsesCreate as Mock).mockResolvedValue({
      output_text: "",
    });

    const result = await translateMessages([{ id: "msg-1", text: "Hola" }], "de");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Translation output was empty");
    }
  });

  it("should handle auth error", async () => {
    (requireAuth as Mock).mockRejectedValue(new Error("Unauthorized"));

    const result = await translateMessages([{ id: "msg-1", text: "Hola" }], "fr");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unauthorized");
    }
  });
});
