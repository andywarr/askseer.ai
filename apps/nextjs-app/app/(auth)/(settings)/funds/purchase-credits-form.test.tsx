import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseCreditsForm } from "./purchase-credits-form";
import { toast } from "sonner";
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
  MAX_FUND_AMOUNT_CENTS,
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

// Mock fetch for checkout
global.fetch = vi.fn();

describe("PurchaseCreditsForm", () => {
  const mockTeams = [
    { id: "team-1", name: "Engineering Team", isPersonal: false, companyId: "company-1", balanceCents: 5000 },
    { id: "team-2", name: "Design Team", isPersonal: false, companyId: "company-2", balanceCents: 1000 },
    { id: "personal-1", name: "My Personal", isPersonal: true, balanceCents: 500 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
    });
  });

  describe("Rendering", () => {
    it("should render the form with team selector and funds input", () => {
      render(<PurchaseCreditsForm teams={mockTeams} />);

      expect(
        screen.getByText("Which team do you want to add funds to?"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("How much would you like to add?"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Checkout" })).toBeInTheDocument();
    });

    it("should show empty placeholder when no teams", () => {
      render(<PurchaseCreditsForm teams={[]} />);

      const selector = screen.getByPlaceholderText("No eligible teams");
      expect(selector).toBeDisabled();
    });
  });

  describe("Funds Input Defaults", () => {
    it("should start with empty dollar amounts until team is selected", () => {
      render(<PurchaseCreditsForm teams={mockTeams} />);

      const input = screen.getByLabelText("How much would you like to add?");
      expect(input).toHaveValue(null);
    });

    it("should default to minimum study cost for personal teams when selected", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);
      await user.click(screen.getByText("My Personal"));

      const minPersonalDollars = (PERSONAL_STUDY_COST_CENTS / 100).toFixed(2);
      expect(screen.getByLabelText("How much would you like to add?")).toHaveValue(Number(minPersonalDollars));
    });

    it("should default to minimum study cost for company teams when selected", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);
      await user.click(screen.getByText("Engineering Team"));

      const minCompanyDollars = (COMPANY_STUDY_COST_CENTS / 100).toFixed(2);
      expect(screen.getByLabelText("How much would you like to add?")).toHaveValue(Number(minCompanyDollars));
    });

    it("should update total text dynamically", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} />);

      const input = screen.getByLabelText("How much would you like to add?");
      await user.clear(input);
      await user.type(input, "150.50");

      expect(screen.getByText("$150.50")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should error if minimum amount is not met", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} />);

      // Select company team
      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);
      await user.click(screen.getByText("Engineering Team"));

      const input = screen.getByLabelText("How much would you like to add?");
      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.blur(input);

      const button = screen.getByRole("button", { name: "Checkout" });
      fireEvent.submit(button.closest("form")!);
      
      const minCompanyDollars = (COMPANY_STUDY_COST_CENTS / 100).toFixed(2);
      expect(toast.error).toHaveBeenCalledWith(`Minimum amount is $${minCompanyDollars}.`);
    });

    it("should error if max amount is exceeded", async () => {
      const user = userEvent.setup();
      render(<PurchaseCreditsForm teams={mockTeams} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);
      await user.click(screen.getByText("My Personal"));

      const input = screen.getByLabelText("How much would you like to add?");
      fireEvent.change(input, { target: { value: "6000.50" } });
      fireEvent.blur(input);

      const button = screen.getByRole("button", { name: "Checkout" });
      await user.click(button);

      const maxFundDollars = (MAX_FUND_AMOUNT_CENTS / 100).toFixed(2);
      expect(toast.error).toHaveBeenCalledWith(`Maximum amount is $${maxFundDollars}.`);
    });

    it("should handle successful checkout", async () => {
      const user = userEvent.setup();
      // Setup successful response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: "https://checkout.stripe.com/test-redirect" }),
      });

      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { ...originalLocation, href: "" };

      render(<PurchaseCreditsForm teams={mockTeams} />);

      const selector = screen.getByPlaceholderText("Select or search teams...");
      await user.click(selector);
      await user.click(screen.getByText("My Personal"));

      const button = screen.getByRole("button", { name: "Checkout" });
      await user.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/credits/checkout", expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ teamId: "personal-1", amountCents: PERSONAL_STUDY_COST_CENTS })
        }));
        expect(window.location.href).toBe("https://checkout.stripe.com/test-redirect");
      });

      // Restore window.location
      (window as any).location = originalLocation;
    });
  });
});
