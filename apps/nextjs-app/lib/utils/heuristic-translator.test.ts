import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  translateHeuristicFamily,
  translateHeuristicFamiliesList,
  getLanguageName,
  clearHeuristicCache,
} from "./heuristic-translator";
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

describe("heuristic-translator utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHeuristicCache();
  });


  describe("getLanguageName", () => {
    it("should return the correct language name", () => {
      expect(getLanguageName("es")).toBe("Spanish");
      expect(getLanguageName("de")).toBe("German");
      expect(getLanguageName("fr")).toBe("French");
      expect(getLanguageName("en")).toBe("English");
      expect(getLanguageName("en-US")).toBe("English");
      expect(getLanguageName(undefined)).toBe("English");
    });
  });

  describe("translateHeuristicFamily", () => {
    const mockFamily = {
      id: "fam-1",
      name: "Nielsen Heuristics",
      description: "Nielsen description",
      key: "NIELSEN",
      heuristics: [
        {
          id: "h-1",
          heuristic: "Visibility of system status",
          category: "System feedback",
          label: "H1",
          examples: [
            {
              id: "ex-1",
              title: "Loading spinner missing",
              example: "A long request does not show a spinner"
            }
          ]
        }
      ]
    };

    it("should return family directly for English locale", async () => {
      const result = await translateHeuristicFamily(mockFamily, "en");
      expect(result).toBe(mockFamily);
      expect((OpenAI as any).mockCreate).not.toHaveBeenCalled();
    });

    it("should call OpenAI and translate family for Spanish locale", async () => {
      const mockOpenAiResponse = {
        output_text: JSON.stringify({
          id: "fam-1",
          name: "Heurísticas de Nielsen",
          description: "Descripción de Nielsen",
          heuristics: [
            {
              id: "h-1",
              heuristic: "Visibilidad del estado del sistema",
              category: "Feedback del sistema",
              label: "Estado del Sistema",
              examples: [
                {
                  id: "ex-1",
                  title: "Falta spinner de carga",
                  example: "Una petición larga no muestra spinner"
                }
              ]
            }
          ]
        })
      };

      ((OpenAI as any).mockCreate as Mock).mockResolvedValue(mockOpenAiResponse);

      const result = await translateHeuristicFamily(mockFamily, "es");

      expect((OpenAI as any).mockCreate).toHaveBeenCalledTimes(1);
      expect(result.name).toBe("Heurísticas de Nielsen");
      expect(result.description).toBe("Descripción de Nielsen");
      expect(result.heuristics[0].heuristic).toBe("Visibilidad del estado del sistema");
      expect(result.heuristics[0].category).toBe("Feedback del sistema");
      expect(result.heuristics[0].label).toBe("Estado del Sistema"); // Translated label
      expect(result.heuristics[0].examples[0].title).toBe("Falta spinner de carga");
      expect(result.heuristics[0].examples[0].example).toBe("Una petición larga no muestra spinner");

      // Verify Cache Hit on subsequent call
      const cacheResult = await translateHeuristicFamily(mockFamily, "es");
      expect(cacheResult).toEqual(result);
      expect((OpenAI as any).mockCreate).toHaveBeenCalledTimes(1); // No new call
    });
  });

  describe("translateHeuristicFamiliesList", () => {
    const mockFamilies = [
      { id: "fam-1", name: "Family 1", description: "Desc 1" },
      { id: "fam-2", name: "Family 2", description: "Desc 2" }
    ];

    it("should return list directly for English locale", async () => {
      const result = await translateHeuristicFamiliesList(mockFamilies, "en");
      expect(result).toBe(mockFamilies);
      expect((OpenAI as any).mockCreate).not.toHaveBeenCalled();
    });

    it("should call OpenAI and translate families list in bulk", async () => {
      const mockOpenAiResponse = {
        output_text: JSON.stringify({
          families: [
            { id: "fam-1", name: "Familia 1", description: "Desc 1 Traducida" },
            { id: "fam-2", name: "Familia 2", description: "Desc 2 Traducida" }
          ]
        })
      };

      ((OpenAI as any).mockCreate as Mock).mockResolvedValue(mockOpenAiResponse);

      const result = await translateHeuristicFamiliesList(mockFamilies, "es");

      expect((OpenAI as any).mockCreate).toHaveBeenCalledTimes(1);
      expect(result[0].name).toBe("Familia 1");
      expect(result[0].description).toBe("Desc 1 Traducida");
      expect(result[1].name).toBe("Familia 2");
      expect(result[1].description).toBe("Desc 2 Traducida");

      // Verify caching: Subsequent calls for one of the families fetches it from the cache
      // during translateHeuristicFamily or translateHeuristicFamiliesList.
      const singleFamilyResult = await translateHeuristicFamily(mockFamilies[0], "es");
      expect(singleFamilyResult.name).toBe("Familia 1");
      expect(singleFamilyResult.description).toBe("Desc 1 Traducida");
    });
  });
});
