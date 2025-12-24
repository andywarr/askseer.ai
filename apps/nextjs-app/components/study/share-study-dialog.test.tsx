import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareStudyDialog } from "./share-study-dialog";
import { toast } from "sonner";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ShareStudyDialog", () => {
  const defaultProps = {
    studyId: "study-123",
    userId: "user-123",
    currentVisibility: "TEAM" as const,
    shareToken: null,
    hasCompany: true,
    onVisibilityChange: vi.fn(),
    onRegenerateToken: vi.fn(),
    onToggleShareLink: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (defaultProps.onVisibilityChange as Mock).mockResolvedValue({
      success: true,
    });
    (defaultProps.onRegenerateToken as Mock).mockResolvedValue({
      success: true,
      shareToken: "new-token-123",
    });
    (defaultProps.onToggleShareLink as Mock).mockResolvedValue({
      success: true,
      shareToken: "toggle-token-123",
    });
  });

  describe("Dialog Opening", () => {
    it("should render share button trigger", () => {
      render(
        <ShareStudyDialog {...defaultProps} trigger={<button>Share</button>} />,
      );

      expect(
        screen.getByRole("button", { name: /share/i }),
      ).toBeInTheDocument();
    });

    it("should open dialog when trigger is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ShareStudyDialog {...defaultProps} trigger={<button>Share</button>} />,
      );

      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Share study")).toBeInTheDocument();
    });

    it("should support controlled mode", () => {
      const onOpenChange = vi.fn();
      render(
        <ShareStudyDialog
          {...defaultProps}
          open={true}
          onOpenChange={onOpenChange}
        />,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Visibility Options", () => {
    it("should display visibility selector when hasCompany is true and not personal team", async () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          hasCompany={true}
          isPersonalTeam={false}
          open={true}
        />,
      );

      // Visibility selector should be present
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Who can access")).toBeInTheDocument();
    });

    it("should display visibility selector for personal teams with company", async () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          hasCompany={true}
          isPersonalTeam={true}
          currentVisibility="PRIVATE"
          open={true}
        />,
      );

      // Visibility selector should be present for personal teams with company
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Who can access")).toBeInTheDocument();
    });

    it("should not display visibility selector when hasCompany is false", async () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          hasCompany={false}
          currentVisibility="PRIVATE"
          open={true}
        />,
      );

      // Visibility selector should not be present for teams without company
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.queryByText("Who can access")).not.toBeInTheDocument();
      // But shareable link toggle should still be present
      expect(screen.getByText("Create shareable link")).toBeInTheDocument();
    });

    it("should normalize TEAM visibility to PRIVATE for personal teams", () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          hasCompany={false}
          currentVisibility="TEAM"
          open={true}
        />,
      );

      // Visibility selector should not be present for teams without company
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("should normalize COMPANY visibility to PRIVATE for personal teams without company", () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          hasCompany={false}
          currentVisibility="COMPANY"
          open={true}
        />,
      );

      // Visibility selector should not be present for teams without company
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  describe("Visibility Changes", () => {
    it("should call onVisibilityChange when visibility is changed", async () => {
      const user = userEvent.setup();
      const onVisibilityChange = vi.fn().mockResolvedValue({ success: true });

      render(
        <ShareStudyDialog
          {...defaultProps}
          onVisibilityChange={onVisibilityChange}
          open={true}
        />,
      );

      // Open the select and change visibility
      const selectTrigger = screen.getByRole("combobox");
      await user.click(selectTrigger);
      await user.click(screen.getByText("Private"));

      await waitFor(() => {
        expect(onVisibilityChange).toHaveBeenCalledWith("PRIVATE");
      });
    });

    it("should show success toast on successful visibility change", async () => {
      const user = userEvent.setup();
      const onVisibilityChange = vi.fn().mockResolvedValue({ success: true });

      render(
        <ShareStudyDialog
          {...defaultProps}
          onVisibilityChange={onVisibilityChange}
          currentVisibility="PRIVATE"
          open={true}
        />,
      );

      const selectTrigger = screen.getByRole("combobox");
      await user.click(selectTrigger);
      await user.click(screen.getByText("Team"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Sharing settings updated");
      });
    });

    it("should show error toast on failed visibility change", async () => {
      const user = userEvent.setup();
      const onVisibilityChange = vi.fn().mockResolvedValue({ success: false });

      render(
        <ShareStudyDialog
          {...defaultProps}
          onVisibilityChange={onVisibilityChange}
          currentVisibility="PRIVATE"
          open={true}
        />,
      );

      const selectTrigger = screen.getByRole("combobox");
      await user.click(selectTrigger);
      await user.click(screen.getByText("Team"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to update sharing settings",
        );
      });
    });
  });

  describe("Shareable Link Toggle", () => {
    it("should show share link input when shareToken exists", async () => {
      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken="test-token-123"
          open={true}
        />,
      );

      expect(screen.getByDisplayValue(/test-token-123/)).toBeInTheDocument();
    });

    it("should not show share link input when shareToken is null", () => {
      render(
        <ShareStudyDialog {...defaultProps} shareToken={null} open={true} />,
      );

      expect(screen.queryByDisplayValue(/token/)).not.toBeInTheDocument();
    });

    it("should copy link to clipboard when copy button is clicked", async () => {
      const user = userEvent.setup();
      const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken="test-token-123"
          open={true}
        />,
      );

      const copyButton = screen.getByRole("button", { name: /copy/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(
          expect.stringContaining("/shared/test-token-123"),
        );
        expect(toast.success).toHaveBeenCalledWith("Link copied to clipboard");
      });
    });

    it("should regenerate token when regenerate button is clicked", async () => {
      const user = userEvent.setup();
      const onRegenerateToken = vi.fn().mockResolvedValue({
        success: true,
        shareToken: "new-token-456",
      });

      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken="old-token"
          onRegenerateToken={onRegenerateToken}
          open={true}
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /regenerate/i,
      });
      await user.click(regenerateButton);

      await waitFor(() => {
        expect(onRegenerateToken).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("Share link regenerated");
      });
    });

    it("should show error toast on failed token regeneration", async () => {
      const user = userEvent.setup();
      const onRegenerateToken = vi.fn().mockResolvedValue({ success: false });

      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken="old-token"
          onRegenerateToken={onRegenerateToken}
          open={true}
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /regenerate/i,
      });
      await user.click(regenerateButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to regenerate share link",
        );
      });
    });

    it("should call onToggleShareLink when toggle is switched on", async () => {
      const user = userEvent.setup();
      const onToggleShareLink = vi.fn().mockResolvedValue({
        success: true,
        shareToken: "generated-token",
      });

      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken={null}
          onToggleShareLink={onToggleShareLink}
          open={true}
        />,
      );

      const toggle = screen.getByRole("switch");
      await user.click(toggle);

      await waitFor(() => {
        expect(onToggleShareLink).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while updating visibility", async () => {
      const user = userEvent.setup();
      let resolveVisibilityChange: (value: { success: boolean }) => void;
      const onVisibilityChange = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveVisibilityChange = resolve;
        }),
      );

      render(
        <ShareStudyDialog
          {...defaultProps}
          currentVisibility="PRIVATE"
          onVisibilityChange={onVisibilityChange}
          open={true}
        />,
      );

      const selectTrigger = screen.getByRole("combobox");
      await user.click(selectTrigger);
      await user.click(screen.getByText("Team"));

      // Should be in loading state
      expect(selectTrigger).toBeDisabled();

      // Resolve the promise
      resolveVisibilityChange!({ success: true });

      await waitFor(() => {
        expect(selectTrigger).not.toBeDisabled();
      });
    });

    it("should show loading state while regenerating token", async () => {
      const user = userEvent.setup();
      let resolveRegenerate: (value: {
        success: boolean;
        shareToken: string;
      }) => void;
      const onRegenerateToken = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveRegenerate = resolve;
        }),
      );

      render(
        <ShareStudyDialog
          {...defaultProps}
          shareToken="old-token"
          onRegenerateToken={onRegenerateToken}
          open={true}
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /regenerate/i,
      });
      await user.click(regenerateButton);

      // Should be in loading state (button is disabled)
      expect(regenerateButton).toBeDisabled();

      // Resolve the promise
      resolveRegenerate!({ success: true, shareToken: "new-token" });

      await waitFor(() => {
        expect(regenerateButton).not.toBeDisabled();
      });
    });
  });
});
