import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransferFundsForm } from "./transfer-funds-form";
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

// Mock the transfer action
vi.mock("@/apps/nextjs-app/lib/actions/balance-actions", () => ({
  transferBalance: vi.fn(),
}));

import { transferBalance } from "@/apps/nextjs-app/lib/actions/balance-actions";

// Mock scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

describe("TransferFundsForm", () => {
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
      id: "team-3",
      name: "Marketing Team",
      isPersonal: false,
      balanceCents: 0,
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
    (transferBalance as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
  });

  describe("Rendering", () => {
    it("should render with from and to team selectors", () => {
      render(<TransferFundsForm teams={mockTeams} />);

      expect(
        screen.getByText("Which team would you like to transfer funds from?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Which team would you like to transfer funds to?"),
      ).toBeInTheDocument();
    });

    it("should render credits input", () => {
      render(<TransferFundsForm teams={mockTeams} />);

      expect(
        screen.getByText("How much would you like to transfer?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("should render transfer button", () => {
      render(<TransferFundsForm teams={mockTeams} />);

      expect(
        screen.getByRole("button", { name: "Transfer" }),
      ).toBeInTheDocument();
    });
  });

  describe("Amount Input", () => {
    it("should start with $1.00 as default", () => {
      render(<TransferFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(1);
    });

    it("should update when user types a value", async () => {
      const user = userEvent.setup();
      render(<TransferFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "25");

      expect(input).toHaveValue(25);
    });

    it("should accept dollar amounts", async () => {
      const user = userEvent.setup();
      render(<TransferFundsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "10.50");

      expect(input).toHaveValue(10.5);
    });
  });

  describe("Team Selection", () => {
    it("should show teams in the from selector", async () => {
      const user = userEvent.setup();
      render(<TransferFundsForm teams={mockTeams} />);

      // Find the first input (from selector) and click it
      const selectors = screen.getAllByPlaceholderText(
        "Select or search teams...",
      );
      await user.click(selectors[0]);

      // Should show teams with remaining label
      expect(screen.getAllByText(/remaining/).length).toBeGreaterThan(0);
    });
  });

  describe("Form Submission", () => {
    it("should disable transfer button when no teams selected", () => {
      render(<TransferFundsForm teams={mockTeams} />);

      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });

    it("should disable transfer button when less than 2 teams", () => {
      const singleTeam = [mockTeams[0]];
      render(<TransferFundsForm teams={singleTeam} />);

      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });
  });

  describe("Minimum Teams Requirement", () => {
    it("should show empty placeholder when less than 2 teams", () => {
      const singleTeam = [mockTeams[0]];
      render(<TransferFundsForm teams={singleTeam} />);

      // With only 1 team, transfer isn't possible
      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });
  });
});
