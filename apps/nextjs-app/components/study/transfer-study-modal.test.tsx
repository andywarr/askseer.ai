import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { TransferStudyModal } from "./transfer-study-modal";
import { handleTransferStudy } from "@/apps/nextjs-app/lib/actions/study-actions";

vi.mock("@/apps/nextjs-app/lib/actions/study-actions", () => ({
  handleTransferStudy: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const adminTeams = [
  { id: "team-1", name: "Design Team", isPersonal: false },
  { id: "team-2", name: "Research Team", isPersonal: false },
  { id: "team-3", name: "My Personal", isPersonal: true },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  studyId: "study-123",
  currentTeamId: "team-1",
  adminTeams,
};

describe("TransferStudyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (handleTransferStudy as Mock).mockResolvedValue({ success: true });
  });

  describe("rendering", () => {
    it("renders dialog title and description when open", () => {
      render(<TransferStudyModal {...defaultProps} />);

      expect(screen.getByText("Transfer Study")).toBeInTheDocument();
      expect(
        screen.getByText("Select the team you want to transfer this study to."),
      ).toBeInTheDocument();
    });

    it("shows Cancel and Transfer buttons", () => {
      render(<TransferStudyModal {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /transfer/i }),
      ).toBeInTheDocument();
    });

    it("shows the current team name when present", () => {
      render(<TransferStudyModal {...defaultProps} />);

      expect(screen.getByText("Current Team:")).toBeInTheDocument();
      expect(screen.getByText("Design Team")).toBeInTheDocument();
    });

    it("does not show current team label when currentTeamId is null", () => {
      render(<TransferStudyModal {...defaultProps} currentTeamId={null} />);

      expect(screen.queryByText("Current Team:")).not.toBeInTheDocument();
    });

    it("does not render dialog content when closed", () => {
      render(<TransferStudyModal {...defaultProps} open={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("team selection", () => {
    it("auto-selects the only available team and enables the Transfer button", () => {
      const singleTeamProps = {
        ...defaultProps,
        currentTeamId: "team-1",
        adminTeams: [
          { id: "team-1", name: "Design Team", isPersonal: false },
          { id: "team-2", name: "Research Team", isPersonal: false },
        ],
      };
      render(<TransferStudyModal {...singleTeamProps} />);

      // Only team-2 is selectable; it should be auto-selected
      const transferButton = screen.getByRole("button", {
        name: /^transfer$/i,
      });
      expect(transferButton).not.toBeDisabled();
    });

    it("filters out the current team from selectable options", async () => {
      const user = userEvent.setup();
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);

      // "Design Team" (team-1) is the current team — it should not appear as a selectable option
      expect(
        screen.queryByRole("option", { name: /design team/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /research team/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /my personal/i }),
      ).toBeInTheDocument();
    });

    it("Transfer button is disabled when no team is selected", () => {
      // Multiple teams → no auto-selection
      render(<TransferStudyModal {...defaultProps} />);

      const transferButton = screen.getByRole("button", {
        name: /^transfer$/i,
      });
      expect(transferButton).toBeDisabled();
    });

    it("enables Transfer button after selecting a team", async () => {
      const user = userEvent.setup();
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));

      const transferButton = screen.getByRole("button", {
        name: /^transfer$/i,
      });
      expect(transferButton).not.toBeDisabled();
    });
  });

  describe("transfer action", () => {
    it("calls handleTransferStudy with the selected team on confirm", async () => {
      const user = userEvent.setup();
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));
      await user.click(screen.getByRole("button", { name: /^transfer$/i }));

      await waitFor(() => {
        expect(handleTransferStudy).toHaveBeenCalledWith("study-123", "team-2");
      });
    });

    it("shows success toast and navigates to /studies on successful transfer", async () => {
      const user = userEvent.setup();
      (handleTransferStudy as Mock).mockResolvedValue({ success: true });
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));
      await user.click(screen.getByRole("button", { name: /^transfer$/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Study transferred successfully",
        );
        expect(mockPush).toHaveBeenCalledWith("/studies");
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows error toast with server message on failed transfer", async () => {
      const user = userEvent.setup();
      (handleTransferStudy as Mock).mockResolvedValue({
        success: false,
        error: "Not authorized to transfer study to the target team",
      });
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));
      await user.click(screen.getByRole("button", { name: /^transfer$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Not authorized to transfer study to the target team",
        );
      });
      expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
    });

    it("shows fallback error toast when action throws", async () => {
      const user = userEvent.setup();
      (handleTransferStudy as Mock).mockRejectedValue(
        new Error("Network error"),
      );
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));
      await user.click(screen.getByRole("button", { name: /^transfer$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to transfer study");
      });
    });

    it("disables Transfer button while transferring", async () => {
      const user = userEvent.setup();
      let resolveTransfer!: (value: any) => void;
      (handleTransferStudy as Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveTransfer = resolve;
        }),
      );
      render(<TransferStudyModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search teams…");
      await user.click(input);
      await user.click(screen.getByText("Research Team"));
      await user.click(screen.getByRole("button", { name: /^transfer$/i }));

      // Button should be disabled while in-flight
      expect(
        screen.getByRole("button", { name: /transferring/i }),
      ).toBeDisabled();

      resolveTransfer({ success: true });
    });
  });

  describe("cancel", () => {
    it("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <TransferStudyModal {...defaultProps} onOpenChange={onOpenChange} />,
      );

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
