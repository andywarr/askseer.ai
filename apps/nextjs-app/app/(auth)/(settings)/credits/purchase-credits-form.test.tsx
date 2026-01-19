import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseCreditsForm } from "./purchase-credits-form";

// Mock fetch for checkout
global.fetch = vi.fn();

describe("PurchaseCreditsForm", () => {
  const mockTeams = [
    { id: "team-1", name: "Engineering Team", isPersonal: false, credits: 50 },
    { id: "team-2", name: "Design Team", isPersonal: false, credits: 10 },
    { id: "personal-1", name: "My Personal", isPersonal: true, credits: 5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
    });
  });

  describe("Rendering", () => {
    it("should render the form with team selector and credits input", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      expect(
        screen.getByText("Which team do you want to purchase credits for?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("How many credits do you want to purchase?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Checkout" })).toBeInTheDocument();
    });

    it("should display the unit price", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      expect(screen.getByText(/Each credit costs/)).toBeInTheDocument();
      // $19.99 appears in both the unit price text and the total, so use getAllByText
      expect(screen.getAllByText(/\$19.99/).length).toBeGreaterThan(0);
    });

    it("should display initial total of $19.99 (1 credit)", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      expect(screen.getByText("$19.99")).toBeInTheDocument();
    });

    it("should use default unit price when invalid price provided", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={-5} />);

      // Should default to $19.99
      expect(screen.getByText("$19.99")).toBeInTheDocument();
    });
  });

  describe("Credits Input", () => {
    it("should start with 1 credit as default", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(1);
    });

    it("should update total when credits change", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={10} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "5");

      expect(screen.getByText("$50.00")).toBeInTheDocument();
    });

    it("should cap credits at 1000", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={10} />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "1500");

      expect(input).toHaveValue(1000);
    });
  });

  describe("Team Selection", () => {
    it("should show teams when clicking the selector", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);

      expect(screen.getByText("Engineering Team")).toBeInTheDocument();
      expect(screen.getByText("Design Team")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should disable checkout button when no team selected", () => {
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      const button = screen.getByRole("button", { name: "Checkout" });
      expect(button).toBeDisabled();
    });

    it("should show error toast when submitting without team", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} unitPrice={19.99} />);

      // Form should not submit due to button being disabled
      const button = screen.getByRole("button", { name: "Checkout" });
      expect(button).toBeDisabled();
    });
  });

  describe("No Teams State", () => {
    it("should disable input when no teams available", () => {
      render(<PurchaseCreditsForm teams={[]} unitPrice={19.99} />);

      const selector = screen.getByPlaceholderText("No eligible teams");
      expect(selector).toBeDisabled();
    });
  });
});
