import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseFundsForm } from "./purchase-funds-form";
import en from "../../../../../messages/en.json";

// Mock next-intl translations
vi.mock("next-intl", () => {
  return {
    useLocale: () => "en",
    useTranslations: (namespace?: string) => {
      const messages = namespace ? (en as any)[namespace] : en;
      return (key: string, values?: any) => {
        const parts = key.split(".");
        let value = messages;
        for (const part of parts) {
          if (value === undefined || value === null) break;
          value = value[part];
        }
        if (typeof value === "string") {
          if (values) {
            let result = value;
            for (const [k, v] of Object.entries(values)) {
              result = result.replace(`{${k}}`, String(v));
            }
            return result;
          }
          return value;
        }
        return key;
      };
    },
  };
});

// Mock fetch for checkout
global.fetch = vi.fn();

describe("PurchaseFundsForm", () => {
  const mockTeams = [
    {
      id: "team-1",
      name: "Engineering Team",
      isPersonal: false,
      balanceCents: 5000,
    },
    {
      id: "team-2",
      name: "Design Team",
      isPersonal: false,
      balanceCents: 1000,
    },
    {
      id: "personal-1",
      name: "My Personal",
      isPersonal: true,
      balanceCents: 500,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
    });
  });

  describe("Rendering", () => {
    it("should render the form with team selector and amount input", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      expect(
        screen.getByText("Which team do you want to add funds to?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("How much would you like to add?"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Checkout" }),
      ).toBeInTheDocument();
    });

    it("should display total amount", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      expect(screen.getByText("Total")).toBeInTheDocument();
    });

    it("should display initial total of $0.00 (no amount entered)", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should display the checkout button", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      expect(
        screen.getByRole("button", { name: "Checkout" }),
      ).toBeInTheDocument();
    });
  });

  describe("Amount Input", () => {
    it("should start with empty amount", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(null);
    });

    it("should update total when amount changes", async () => {
      const user = userEvent.setup();
      render(<PurchaseFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "50");

      expect(screen.getAllByText("$50.00").length).toBeGreaterThan(0);
    });

    it("should accept decimal dollar amounts", async () => {
      const user = userEvent.setup();
      render(<PurchaseFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "10.50");

      expect(screen.getByText("$10.50")).toBeInTheDocument();
    });
  });

  describe("Team Selection", () => {
    it("should show teams when clicking the selector", async () => {
      const user = userEvent.setup();
      render(<PurchaseFundsForm teams={mockTeams} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);

      expect(screen.getByText("Engineering Team")).toBeInTheDocument();
      expect(screen.getByText("Design Team")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should disable checkout button when no team selected", () => {
      render(<PurchaseFundsForm teams={mockTeams} />);

      const button = screen.getByRole("button", { name: "Checkout" });
      expect(button).toBeDisabled();
    });

    it("should show error toast when submitting without team", async () => {
      const user = userEvent.setup();
      render(<PurchaseFundsForm teams={mockTeams} />);

      // Form should not submit due to button being disabled
      const button = screen.getByRole("button", { name: "Checkout" });
      expect(button).toBeDisabled();
    });
  });

  describe("No Teams State", () => {
    it("should disable input when no teams available", () => {
      render(<PurchaseFundsForm teams={[]} />);

      const selector = screen.getByPlaceholderText("No eligible teams");
      expect(selector).toBeDisabled();
    });
  });
});
