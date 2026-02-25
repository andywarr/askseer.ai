import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransferCreditsForm } from "./transfer-credits-form";
import { toast } from "sonner";

// Mock the transfer action
vi.mock("@/apps/nextjs-app/lib/actions/balance-actions", () => ({
  transferBalance: vi.fn(),
}));

import { transferBalance } from "@/apps/nextjs-app/lib/actions/balance-actions";

// Mock scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

describe("TransferCreditsForm", () => {
  const mockTeams = [
    { id: "team-1", name: "Engineering Team", isPersonal: false, balanceCents: 5000 },
    { id: "team-2", name: "Design Team", isPersonal: false, balanceCents: 1000 },
    { id: "team-3", name: "Marketing Team", isPersonal: false, balanceCents: 0 },
    { id: "personal-1", name: "My Personal", isPersonal: true, balanceCents: 500 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (transferBalance as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
  });

  describe("Rendering", () => {
    it("should render with from and to team selectors", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(
        screen.getByText("Which team would you like to transfer funds from?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Which team would you like to transfer funds to?"),
      ).toBeInTheDocument();
    });

    it("should render amount input", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(
        screen.getByText("How much would you like to transfer?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("should render transfer button", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      expect(screen.getByRole("button", { name: "Transfer" })).toBeInTheDocument();
    });
  });

  describe("Amount Input", () => {
    it("should start with 1 as default", () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(1);
    });

    it("should update when user types a value", async () => {
      render(<TransferCreditsForm teams={mockTeams} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "25.00" } });
      fireEvent.blur(input);

      expect(input).toHaveValue(25);
    });
  });

  describe("Team Selection", () => {
    it("should show teams in the from selector", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      // Find the first input (from selector) and click it
      const selectors = screen.getAllByPlaceholderText("Select or search teams...");
      await user.click(selectors[0]);

      // Should show teams with 'remaining' info
      expect(screen.getAllByText(/remaining/).length).toBeGreaterThan(0);
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

    it("should handle error when transfer amount > source team balance", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      const selectors = screen.getAllByPlaceholderText("Select or search teams...");
      
      // Select From Team
      await user.click(selectors[0]);
      await user.click(screen.getAllByText("Engineering Team")[0]); // Base $50

      // Select To Team
      await user.click(selectors[1]);
      await user.click(screen.getAllByText("Design Team")[0]);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "100" } }); // > $50
      fireEvent.blur(input);

      const button = screen.getByRole("button", { name: "Transfer" });
      fireEvent.submit(button.closest("form")!);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("The source team only has $50.00.");
      });
    });

    it("should submit standard transfer correctly", async () => {
      const user = userEvent.setup();
      render(<TransferCreditsForm teams={mockTeams} />);

      const selectors = screen.getAllByPlaceholderText("Select or search teams...");
      
      await user.click(selectors[0]);
      await user.click(screen.getAllByText("Engineering Team")[0]); 

      await user.click(selectors[1]);
      await user.click(screen.getAllByText("Design Team")[0]);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "10.00" } });
      fireEvent.blur(input);

      const button = screen.getByRole("button", { name: "Transfer" });
      fireEvent.submit(button.closest("form")!);

      await waitFor(() => {
        expect(transferBalance).toHaveBeenCalledWith({
          fromTeamId: "team-1",
          toTeamId: "team-2",
          amountCents: 1000,
        });
        expect(toast.success).toHaveBeenCalledWith("Successfully transferred $10.00.");
        expect(input).toHaveValue(1); 
      });
    });
  });
});
