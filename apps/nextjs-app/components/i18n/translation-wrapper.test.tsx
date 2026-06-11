import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { TranslationWrapper, clearTranslationCache } from "./translation-wrapper";
import { TranslationProvider, useTranslationContext } from "./translation-context";
import { translateText } from "@/apps/nextjs-app/lib/actions/translate-actions";
import { useLocale } from "next-intl";

vi.mock("@/apps/nextjs-app/lib/actions/translate-actions", () => ({
  translateText: vi.fn(),
}));

vi.mock("next-intl", async (importOriginal) => {
  const original = await importOriginal<typeof import("next-intl")>();
  return {
    ...original,
    useLocale: vi.fn(() => "en"),
    useTranslations: (namespace?: string) => {
      // Mock simple translator lookup for the test
      const messages: Record<string, string> = {
        "translating": "Translating...",
        "showOriginal": "Show original",
        "translatedByAi": "Translated by AI",
        "translateTo": "Translate to {language}",
        "languages.en": "English",
        "languages.es": "Spanish",
        "languages.fr": "French",
        "languages.de": "German",
      };
      return (key: string, values?: any) => {
        let val = messages[key] || key;
        if (values) {
          for (const [k, v] of Object.entries(values)) {
            val = val.replace(`{${k}}`, String(v));
          }
        }
        return val;
      };
    },
  };
});

describe("TranslationWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTranslationCache();
    (useLocale as Mock).mockReturnValue("en");
    (translateText as Mock).mockResolvedValue({
      success: true,
      data: { translatedText: "Hello (translated)" },
    });
  });

  it("renders text normally if sourceLocale matches activeLocale", () => {
    render(<TranslationWrapper text="Hello" sourceLocale="en" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders translate button if sourceLocale does not match activeLocale", () => {
    render(<TranslationWrapper text="Hola" sourceLocale="es" />);

    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translate to English" })).toBeInTheDocument();
  });

  it("calls translateText and shows translated content upon clicking translate", async () => {
    let resolveTranslation!: (val: any) => void;
    const translationPromise = new Promise((resolve) => {
      resolveTranslation = resolve;
    });
    (translateText as Mock).mockReturnValue(translationPromise);

    const user = userEvent.setup();
    render(<TranslationWrapper text="Hola" sourceLocale="es" />);

    const btn = screen.getByRole("button", { name: "Translate to English" });
    await user.click(btn);

    // Should show loading state
    expect(screen.getByText("Translating...")).toBeInTheDocument();

    // Resolve the promise
    resolveTranslation({
      success: true,
      data: { translatedText: "Hello (translated)" },
    });

    await waitFor(() => {
      expect(translateText).toHaveBeenCalledWith("Hola", "en");
      expect(screen.getByText("Hello (translated)")).toBeInTheDocument();
      expect(screen.getByText("Translated by AI")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show original" })).toBeInTheDocument();
    });
  });


  it("allows toggling back and forth between original and translated text", async () => {
    const user = userEvent.setup();
    render(<TranslationWrapper text="Hola" sourceLocale="es" />);

    // Click translate
    await user.click(screen.getByRole("button", { name: "Translate to English" }));
    await waitFor(() => {
      expect(screen.getByText("Hello (translated)")).toBeInTheDocument();
    });

    // Click show original
    await user.click(screen.getByRole("button", { name: "Show original" }));
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translate to English" })).toBeInTheDocument();

    // Click translate again (should be instant, no second server call)
    await user.click(screen.getByRole("button", { name: "Translate to English" }));
    expect(screen.getByText("Hello (translated)")).toBeInTheDocument();
    expect(translateText).toHaveBeenCalledTimes(1); // Only once! Cached!
  });

  it("displays toast error if translateText action fails", async () => {
    const user = userEvent.setup();
    (translateText as Mock).mockResolvedValue({
      success: false,
      error: "Translation API failed",
    });

    render(<TranslationWrapper text="Hola" sourceLocale="es" />);
    await user.click(screen.getByRole("button", { name: "Translate to English" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Translation API failed");
      // Keep showing original
      expect(screen.getByText("Hola")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Translate to English" })).toBeInTheDocument();
    });
  });

  it("translates automatically and hides controls when global translation is toggled", async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      return (
        <TranslationProvider>
          <ConsumerComponent />
        </TranslationProvider>
      );
    };

    const ConsumerComponent = () => {
      const context = useTranslationContext();
      return (
        <div>
          <button onClick={() => context?.setGlobalTranslated(true)}>Global Translate</button>
          <button onClick={() => context?.setGlobalTranslated(false)}>Global Show Original</button>
          <TranslationWrapper text="Hola" sourceLocale="es" />
        </div>
      );
    };

    render(<TestComponent />);

    // Initially, original text shown, no inline translate button
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Translate to English" })).not.toBeInTheDocument();

    // Trigger global translation
    await user.click(screen.getByRole("button", { name: "Global Translate" }));

    // Should fetch and show translated text, still no inline translate/show-original buttons
    await waitFor(() => {
      expect(translateText).toHaveBeenCalledWith("Hola", "en");
      expect(screen.getByText("Hello (translated)")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show original" })).not.toBeInTheDocument();
    });

    // Trigger global show original
    await user.click(screen.getByRole("button", { name: "Global Show Original" }));
    expect(screen.getByText("Hola")).toBeInTheDocument();
  });

  it("renders with span instead of block paragraph when inline is true", () => {
    const { container } = render(<TranslationWrapper text="Hello" sourceLocale="en" inline />);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe("Hello");
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("handles loading and rendering inline structure correctly", async () => {
    (useLocale as Mock).mockReturnValue("es");
    const { container } = render(<TranslationWrapper text="Hello" sourceLocale="en" inline />);
    expect(container.querySelector("span.inline-flex")).toBeInTheDocument();
  });
});
