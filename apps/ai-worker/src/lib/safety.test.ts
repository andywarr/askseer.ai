import { describe, it, expect } from "vitest";
import { escapeXml, wrapInXml } from "./safety.ts";

describe("safety utilities", () => {
  describe("escapeXml", () => {
    it("should return empty string for empty input", () => {
      expect(escapeXml("")).toBe("");
    });

    it("should escape < and > symbols", () => {
      expect(escapeXml("hello <world>")).toBe("hello &lt;world&gt;");
    });

    it("should handle nested or multiple tags", () => {
      expect(escapeXml("<div><p>text</p></div>")).toBe("&lt;div&gt;&lt;p&gt;text&lt;/p&gt;&lt;/div&gt;");
    });

    it("should not modify text without < or >", () => {
      expect(escapeXml("hello world 123 !@#")).toBe("hello world 123 !@#");
    });
  });

  describe("wrapInXml", () => {
    it("should wrap text in tags and escape content", () => {
      const result = wrapInXml("user_goal", "I want to <test> prompt injection");
      expect(result).toBe("<user_goal>\nI want to &lt;test&gt; prompt injection\n</user_goal>");
    });

    it("should handle null or undefined input gracefully", () => {
      expect(wrapInXml("test", null)).toBe("<test>\n\n</test>");
      expect(wrapInXml("test", undefined)).toBe("<test>\n\n</test>");
    });
  });
});
