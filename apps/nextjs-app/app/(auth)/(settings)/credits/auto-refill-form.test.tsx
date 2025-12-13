import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoRefillForm } from "./auto-refill-form";
import { toast } from "sonner";

// Mock scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

// Mock credit actions
vi.mock("@/apps/nextjs-app/lib/actions/credit-actions", () => ({
  getAutoRefillSettings: vi.fn(),
  updateAutoRefillSettings: vi.fn(),
  createCheckoutSessionForPaymentSetup: vi.fn(),
  processCheckoutSuccess: vi.fn(),
  removePaymentMethod: vi.fn(),
}));

import {
  getAutoRefillSettings,
  updateAutoRefillSettings,
  createCheckoutSessionForPaymentSetup,
  processCheckoutSuccess,
  removePaymentMethod,
} from "@/apps/nextjs-app/lib/actions/credit-actions";

// Track the current search params for tests
let mockSearchParams = new URLSearchParams();

// Override the global mock for useSearchParams
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/credits",
}));

describe("AutoRefillForm", () => {
  const mockTeams = [
    { id: "team-1", name: "Engineering Team", isPersonal: false, credits: 50 },
    { id: "team-2", name: "Design Team", isPersonal: false, credits: 5 },
    { id: "personal-1", name: "My Personal", isPersonal: true, credits: 10 },
  ];

  const mockSettings = {
    autoRefillEnabled: false,
    autoRefillThreshold: 5,
    autoRefillAmount: 0,
    paymentMethodLast4: null,
    paymentMethodBrand: null,
  };

  const mockSettingsWithPayment = {
    ...mockSettings,
    paymentMethodLast4: "4242",
    paymentMethodBrand: "visa",
  };

  const mockSettingsEnabled = {
    ...mockSettingsWithPayment,
    autoRefillEnabled: true,
    autoRefillThreshold: 10,
    autoRefillAmount: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (getAutoRefillSettings as Mock).mockResolvedValue({
      success: true,
      data: mockSettings,
    });
  });

  describe("Team Selection", () => {
    it("should render team selector with all teams", async () => {
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      expect(
        screen.getByText("Which team do you want to set up auto-refills?"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Select or search teams..."),
      ).toBeInTheDocument();
    });

    it("should auto-select team when only one team exists", async () => {
      const singleTeam = [mockTeams[0]];
      render(<AutoRefillForm teams={singleTeam} unitPrice={4.99} />);

      await waitFor(() => {
        expect(getAutoRefillSettings).toHaveBeenCalledWith("team-1");
      });
    });

    it("should show 'No eligible teams' when no teams are available", () => {
      render(<AutoRefillForm teams={[]} unitPrice={4.99} />);

      expect(
        screen.getByPlaceholderText("No eligible teams"),
      ).toBeInTheDocument();
    });

    it("should load settings when team is selected", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      // Find and click team
      const teamOption = await screen.findByText("Engineering Team");
      await user.click(teamOption);

      await waitFor(() => {
        expect(getAutoRefillSettings).toHaveBeenCalledWith("team-1");
      });
    });

    it("should display credit count with color coding", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      // Low credits (amber)
      expect(screen.getByText("5 credits")).toBeInTheDocument();
      // Normal credits
      expect(screen.getByText("50 credits")).toBeInTheDocument();
    });

    it("should separate teams into regular and personal groups", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText("Teams")).toBeInTheDocument();
      expect(screen.getByText("Personal")).toBeInTheDocument();
    });
  });

  describe("Form Inputs", () => {
    it("should display threshold and amount inputs", () => {
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      expect(screen.getByLabelText("When to refill?")).toBeInTheDocument();
      expect(
        screen.getByLabelText("How many credits do you want to purchase?"),
      ).toBeInTheDocument();
    });

    it("should show default threshold and amount values", () => {
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const thresholdInput = screen.getByLabelText("When to refill?");
      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );

      expect(thresholdInput).toHaveValue(5);
      expect(amountInput).toHaveValue(0);
    });

    it("should cap threshold at MAX_THRESHOLD (100)", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const thresholdInput = screen.getByLabelText("When to refill?");
      await user.clear(thresholdInput);
      await user.type(thresholdInput, "150");

      expect(thresholdInput).toHaveValue(100);
    });

    it("should cap amount at MAX_AMOUNT (1000)", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "1500");

      expect(amountInput).toHaveValue(1000);
    });

    it("should calculate and display total cost", () => {
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      // Default amount is 0, price is 4.99, so total is $0.00
      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should update total cost when amount changes", async () => {
      const user = userEvent.setup();
      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "10");

      // 10 * 4.99 = $49.90
      expect(screen.getByText("$49.90")).toBeInTheDocument();
    });

    it("should display unit price", () => {
      render(<AutoRefillForm teams={mockTeams} unitPrice={19.99} />);

      expect(screen.getByText(/Each credit costs/)).toBeInTheDocument();
      expect(screen.getByText(/\$19\.99/)).toBeInTheDocument();
    });
  });

  describe("Payment Method", () => {
    it("should show 'Add Payment Method' button when no payment method exists", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettings,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Add Payment Method/i }),
        ).toBeInTheDocument();
      });
    });

    it("should show payment method card when one exists", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("visa")).toBeInTheDocument();
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });
    });

    it("should show Update and Delete buttons when payment method exists", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Update/i }),
        ).toBeInTheDocument();
      });
    });

    it("should redirect to Stripe checkout when adding payment method", async () => {
      const user = userEvent.setup();
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { ...originalLocation, href: "" };

      (createCheckoutSessionForPaymentSetup as Mock).mockResolvedValue({
        success: true,
        checkoutUrl: "https://checkout.stripe.com/session123",
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText(/Add Payment Method/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", {
        name: /Add Payment Method/i,
      });
      await user.click(addButton);

      await waitFor(() => {
        expect(createCheckoutSessionForPaymentSetup).toHaveBeenCalledWith(
          "team-1",
        );
        expect(window.location.href).toBe(
          "https://checkout.stripe.com/session123",
        );
      });

      window.location.href = originalLocation.href;
    });

    it("should show error toast when payment setup fails", async () => {
      const user = userEvent.setup();
      (createCheckoutSessionForPaymentSetup as Mock).mockResolvedValue({
        success: false,
        error: "Failed to create checkout session",
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText(/Add Payment Method/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", {
        name: /Add Payment Method/i,
      });
      await user.click(addButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to create checkout session",
        );
      });
    });
  });

  describe("Enable/Disable Auto-Refill", () => {
    it("should disable Enable button when no payment method", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettings,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        const enableButton = screen.getByRole("button", {
          name: /Enable/i,
        });
        expect(enableButton).toBeDisabled();
      });
    });

    it("should enable Enable button when payment method exists and amount is valid", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Enter a valid amount
      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "10");

      const enableButton = screen.getByRole("button", {
        name: /Enable/i,
      });
      expect(enableButton).not.toBeDisabled();
    });

    it("should disable Enable button when amount is 0", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Default amount is 0, button should be disabled
      const enableButton = screen.getByRole("button", {
        name: /Enable/i,
      });
      expect(enableButton).toBeDisabled();
    });

    it("should call updateAutoRefillSettings when enabling", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });
      (updateAutoRefillSettings as Mock).mockResolvedValue({ success: true });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Enter a valid amount before enabling
      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "20");

      const enableButton = screen.getByRole("button", {
        name: /Enable/i,
      });
      await user.click(enableButton);

      await waitFor(() => {
        expect(updateAutoRefillSettings).toHaveBeenCalledWith({
          teamId: "team-1",
          autoRefillEnabled: true,
          autoRefillThreshold: 5,
          autoRefillAmount: 20,
        });
        expect(toast.success).toHaveBeenCalledWith("Auto-refill enabled");
      });
    });

    it("should show Disable button when auto-refill is active", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsEnabled,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Disable/i }),
        ).toBeInTheDocument();
      });
    });

    it("should call updateAutoRefillSettings when disabling", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsEnabled,
      });
      (updateAutoRefillSettings as Mock).mockResolvedValue({ success: true });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      const disableButton = screen.getByRole("button", {
        name: /Disable/i,
      });
      await user.click(disableButton);

      await waitFor(() => {
        expect(updateAutoRefillSettings).toHaveBeenCalledWith({
          teamId: "team-1",
          autoRefillEnabled: false,
          autoRefillThreshold: 10,
          autoRefillAmount: 50,
        });
        expect(toast.success).toHaveBeenCalledWith("Auto-refill disabled");
      });
    });

    it("should show Update Auto-Refill button when settings are changed while enabled", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsEnabled,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Initially no Update Auto-Refill button
      expect(
        screen.queryByRole("button", { name: /Update Auto-Refill/i }),
      ).not.toBeInTheDocument();

      // Change the amount
      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "100");

      // Now Update Auto-Refill button should appear
      expect(
        screen.getByRole("button", { name: /Update Auto-Refill/i }),
      ).toBeInTheDocument();
    });

    it("should call updateAutoRefillSettings when updating settings", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsEnabled,
      });
      (updateAutoRefillSettings as Mock).mockResolvedValue({ success: true });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Change the threshold
      const thresholdInput = screen.getByLabelText("When to refill?");
      await user.clear(thresholdInput);
      await user.type(thresholdInput, "25");

      const updateButton = screen.getByRole("button", {
        name: /Update Auto-Refill/i,
      });
      await user.click(updateButton);

      await waitFor(() => {
        expect(updateAutoRefillSettings).toHaveBeenCalledWith({
          teamId: "team-1",
          autoRefillEnabled: true,
          autoRefillThreshold: 25,
          autoRefillAmount: 50,
        });
        expect(toast.success).toHaveBeenCalledWith(
          "Auto-refill settings updated",
        );
      });
    });

    it("should show error toast when enabling fails", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });
      (updateAutoRefillSettings as Mock).mockResolvedValue({
        success: false,
        error: "Threshold must be positive",
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Enter a valid amount to enable the button
      const amountInput = screen.getByLabelText(
        "How many credits do you want to purchase?",
      );
      await user.clear(amountInput);
      await user.type(amountInput, "10");

      const enableButton = screen.getByRole("button", {
        name: /Enable/i,
      });
      await user.click(enableButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Threshold must be positive");
      });
    });
  });

  describe("Remove Payment Method", () => {
    it("should show confirmation dialog when clicking delete", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Find the delete button (trash icon)
      const deleteButton = screen.getByRole("button", { name: "" });
      await user.click(deleteButton);

      expect(screen.getByText("Remove Payment Method?")).toBeInTheDocument();
      expect(
        screen.getByText(/This will also disable auto-refill for this team/),
      ).toBeInTheDocument();
    });

    it("should call removePaymentMethod when confirming removal", async () => {
      const user = userEvent.setup();
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });
      (removePaymentMethod as Mock).mockResolvedValue({ success: true });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("•••• 4242")).toBeInTheDocument();
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole("button", { name: "" });
      await user.click(deleteButton);

      // Click confirm in dialog
      const confirmButton = screen.getByRole("button", {
        name: /Remove Payment Method/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(removePaymentMethod).toHaveBeenCalledWith("team-1");
        expect(toast.success).toHaveBeenCalledWith(
          "Payment method removed and auto-refill disabled",
        );
      });
    });
  });

  describe("Checkout Return Handling", () => {
    it("should process successful checkout return", async () => {
      mockSearchParams = new URLSearchParams({
        setup_success: "true",
        team: "team-1",
        session_id: "cs_test_123",
      });

      (processCheckoutSuccess as Mock).mockResolvedValue({
        success: true,
        paymentMethod: { last4: "4242", brand: "visa" },
      });

      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: true,
        data: mockSettingsWithPayment,
      });

      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      await waitFor(() => {
        expect(processCheckoutSuccess).toHaveBeenCalledWith(
          "cs_test_123",
          "team-1",
        );
        expect(toast.success).toHaveBeenCalledWith(
          "Payment method •••• 4242 saved",
        );
      });
    });

    it("should show error toast when checkout processing fails", async () => {
      mockSearchParams = new URLSearchParams({
        setup_success: "true",
        team: "team-1",
        session_id: "cs_test_123",
      });

      (processCheckoutSuccess as Mock).mockResolvedValue({
        success: false,
        error: "Session expired",
      });

      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Session expired");
      });
    });

    it("should show info toast when checkout is cancelled", async () => {
      mockSearchParams = new URLSearchParams({
        setup_cancelled: "true",
        team: "team-1",
      });

      render(<AutoRefillForm teams={mockTeams} unitPrice={4.99} />);

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith("Payment setup was cancelled");
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while fetching settings", async () => {
      let resolveSettings: (value: any) => void;
      (getAutoRefillSettings as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSettings = resolve;
          }),
      );

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      });

      // Resolve the promise
      resolveSettings!({ success: true, data: mockSettings });

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });

    it("should disable inputs while loading", async () => {
      let resolveSettings: (value: any) => void;
      (getAutoRefillSettings as Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSettings = resolve;
          }),
      );

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(screen.getByLabelText("When to refill?")).toBeDisabled();
        expect(
          screen.getByLabelText("How many credits do you want to purchase?"),
        ).toBeDisabled();
      });

      resolveSettings!({ success: true, data: mockSettings });
    });
  });

  describe("Error Handling", () => {
    it("should show error toast when loading settings fails", async () => {
      (getAutoRefillSettings as Mock).mockResolvedValue({
        success: false,
        error: "Access denied",
      });

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Access denied");
      });
    });

    it("should show generic error toast on network failure", async () => {
      (getAutoRefillSettings as Mock).mockRejectedValue(
        new Error("Network error"),
      );

      render(<AutoRefillForm teams={[mockTeams[0]]} unitPrice={4.99} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to load auto-refill settings",
        );
      });
    });
  });
});
