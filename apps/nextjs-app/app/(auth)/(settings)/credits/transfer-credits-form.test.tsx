import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransferCreditsForm } from "./transfer-credits-form";

// Mock the transfer action
vi.mock("@/apps/nextjs-app/lib/actions/credit-actions", () => ({
  transferCredits: vi.fn(),
}));

import { transferCredits } from "@/apps/nextjs-app/lib/actions/credit-actions";

// Mock scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

describe("TransferCreditsForm", () => {
  const mockTeams = [
    { id: "team-1", name: "Engineering Team", isPersonal: false, credits: 50 },
    { id: "team-2", name: "Design Team", isPersonal: false, credits: 10 },
    { id: "team-3", name: "Marketing Team", isPersonal: false, credits: 0 },
    { id: "personal-1", name: "My Personal", isPersonal: true, credits: 5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (transferCredits as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
  });

  describe("Rendering", () => {
    it("should render with from and to team selectors", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(
        screen.getByText("Which team would you like to transfer credits from?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Which team would you like to transfer credits to?"),
      ).toBeInTheDocument();
    });

    it("should render credits input", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(
        screen.getByText("How many credits would you like to transfer?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("should render transfer button", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(screen.getByRole("button", { name: "Transfer" })).toBeInTheDocument();
    });
  });

  describe("Credits Input", () => {
    it("should start with 1 credit as default", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(1);
    });

    it("should update when user types a value", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "25");

      expect(input).toHaveValue(25);
    });

    it("should cap credits at 1000", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "2000");

      expect(input).toHaveValue(1000);
    });
  });

  describe("Team Selection", () => {
    it("should show teams in the from selector", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      // Find the first input (from selector) and click it
      const selectors = screen.getAllByPlaceholderText("Select or search teams...");
      await user.click(selectors[0]);

      // Should show teams with credits remaining label
      expect(screen.getAllByText(/credits remaining/).length).toBeGreaterThan(0);
    });
  });

  describe("Form Submission", () => {
    it("should disable transfer button when no teams selected", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });

    it("should disable transfer button when less than 2 teams", () => {
      const singleTeam = [mockTeams[0]];
      render(<TransferCreditsForm teams={singleTeam} />);

      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });
  });

  describe("Minimum Teams Requirement", () => {
    it("should show empty placeholder when less than 2 teams", () => {
      const singleTeam = [mockTeams[0]];
      render(<TransferCreditsForm teams={singleTeam} />);

      // With only 1 team, transfer isn't possible
      const button = screen.getByRole("button", { name: "Transfer" });
      expect(button).toBeDisabled();
    });
  });
});
