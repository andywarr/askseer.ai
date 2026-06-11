import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  translateCWQuestionsList,
  clearQuestionCache,
} from "./walkthrough-translator";
import OpenAI from "openai";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  class MockOpenAI {
    static mockCreate = mockCreate;
    responses = {
      create: mockCreate,
    };
  }
  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

describe("walkthrough-translator utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearQuestionCache();
  });

  const mockQuestions = [
    { id: "q-1", question: "Will the user try to achieve the right effect?" },
    { id: "q-2", question: "Will the user notice that the correct action is available?" }
  ];

  it("should return questions directly for English locale", async () => {
    const result = await translateCWQuestionsList(mockQuestions, "en");
    expect(result).toBe(mockQuestions);
    expect((OpenAI as any).mockCreate).not.toHaveBeenCalled();
  });

  it("should call OpenAI and translate questions for Spanish locale", async () => {
    const mockOpenAiResponse = {
      output_text: JSON.stringify({
        questions: [
          { id: "q-1", question: "¿Intentará el usuario lograr el efecto correcto?" },
          { id: "q-2", question: "¿Notará el usuario que la acción correcta está disponible?" }
        ]
      })
    };

    ((OpenAI as any).mockCreate as Mock).mockResolvedValue(mockOpenAiResponse);

    const result = await translateCWQuestionsList(mockQuestions, "es");

    expect((OpenAI as any).mockCreate).toHaveBeenCalledTimes(1);
    expect(result[0].question).toBe("¿Intentará el usuario lograr el efecto correcto?");
    expect(result[1].question).toBe("¿Notará el usuario que la acción correcta está disponible?");

    // Verify cache hit: Subsequent call should not query OpenAI
    const cacheResult = await translateCWQuestionsList(mockQuestions, "es");
    expect(cacheResult).toEqual(result);
    expect((OpenAI as any).mockCreate).toHaveBeenCalledTimes(1);
  });
});
