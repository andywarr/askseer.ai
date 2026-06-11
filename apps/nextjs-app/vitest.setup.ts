import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock ResizeObserver as a proper class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver as a proper class
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}
global.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock next-auth to avoid next/server import issues
vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("@/apps/nextjs-app/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "test-user-id", email: "test@example.com" },
    }),
  ),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock PointerCapture methods for Radix UI
global.Element.prototype.hasPointerCapture = vi.fn(() => false);
global.Element.prototype.setPointerCapture = vi.fn();
global.Element.prototype.releasePointerCapture = vi.fn();
global.Element.prototype.scrollIntoView = vi.fn();

// Mock next-intl globally
import en from "./messages/en.json";
vi.mock("next-intl", () => {
  const getTranslator = (namespace?: string) => {
    const messages = namespace
      ? namespace.split(".").reduce((acc, part) => (acc as any)?.[part], en)
      : en;
    return (key: string, values?: any) => {
      const parts = key.split(".");
      let value = messages;
      for (const part of parts) {
        if (value === undefined || value === null) break;
        value = (value as any)[part];
      }
      if (typeof value === "string") {
        if (values) {
          let result: string = value;
          const pluralIdx = result.indexOf(", plural,");
          if (pluralIdx !== -1) {
            let openBraceIdx = -1;
            for (let i = pluralIdx; i >= 0; i--) {
              if (result[i] === '{') {
                openBraceIdx = i;
                break;
              }
            }
            if (openBraceIdx !== -1) {
              let braceCount = 1;
              let closeBraceIdx = -1;
              for (let i = openBraceIdx + 1; i < result.length; i++) {
                if (result[i] === '{') braceCount++;
                else if (result[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    closeBraceIdx = i;
                    break;
                  }
                }
              }
              if (closeBraceIdx !== -1) {
                const fullMatch = result.substring(openBraceIdx, closeBraceIdx + 1);
                const variable = result.substring(openBraceIdx + 1, pluralIdx).trim();
                const rulesStr = result.substring(pluralIdx + 9, closeBraceIdx).trim();
                const countVal = Number(values[variable]);
                const caseRegex = /([=\w]+)\s*\{([^\}]+)\}/g;
                let caseMatch;
                const cases: Record<string, string> = {};
                while ((caseMatch = caseRegex.exec(rulesStr)) !== null) {
                  cases[caseMatch[1]] = caseMatch[2];
                }
                let chosenTemplate = cases[`=${countVal}`] || cases[countVal.toString()] || cases['other'] || '';
                chosenTemplate = chosenTemplate.replace('#', String(countVal));
                result = result.replace(fullMatch, chosenTemplate);
              }
            }
          }
          for (const [k, v] of Object.entries(values)) {
            result = result.replace(`{${k}}`, String(v));
          }
          return result;
        }
        return value;
      }
      return key;
    };
  };

  return {
    useTranslations: (namespace?: string) => getTranslator(namespace),
    getTranslations: (namespace?: string) => Promise.resolve(getTranslator(namespace)),
    useLocale: () => "en",
  };
});

