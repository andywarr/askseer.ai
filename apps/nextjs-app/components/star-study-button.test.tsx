import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarStudyButton } from "./star-study-button";

// Mock the data module
vi.mock("@/apps/nextjs-app/lib/data", () => ({
  toggleStudyStar: vi.fn(),
}));

import { toggleStudyStar } from "@/apps/nextjs-app/lib/data";

describe("StarStudyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("icon variant (default)", () => {
    it("should render unstarred state correctly", () => {
      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
        />,
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(screen.getByText("Star study")).toBeInTheDocument();
    });

    it("should render starred state correctly", () => {
      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={true}
        />,
      );

      expect(screen.getByText("Unstar study")).toBeInTheDocument();
    });

    it("should toggle star state when clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: true,
        isStarred: true,
      });

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(toggleStudyStar).toHaveBeenCalledWith("user-123", "study-123");
      });
    });

    it("should update visual state after successful toggle", async () => {
      const user = userEvent.setup();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: true,
        isStarred: true,
      });

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
        />,
      );

      expect(screen.getByText("Star study")).toBeInTheDocument();

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Unstar study")).toBeInTheDocument();
      });
    });

    it("should call onToggle callback when toggled", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: true,
        isStarred: true,
      });

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
          onToggle={onToggle}
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(true);
      });
    });

    it("should not update state if toggle fails", async () => {
      const user = userEvent.setup();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: false,
        isStarred: false,
      });

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Star study")).toBeInTheDocument();
      });
    });

    it("should be disabled while pending", async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolveToggle: (value: any) => void;
      const togglePromise = new Promise((resolve) => {
        resolveToggle = resolve;
      });
      vi.mocked(toggleStudyStar).mockReturnValue(togglePromise as any);

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Button should be disabled while pending
      expect(button).toBeDisabled();

      // Resolve the promise
      resolveToggle!({ success: true, isStarred: true });

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe("menuItem variant", () => {
    it("should render as menu item with correct text", () => {
      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
          variant="menuItem"
        />,
      );

      expect(screen.getByText("Star")).toBeInTheDocument();
    });

    it("should show 'Unstar' when starred", () => {
      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={true}
          variant="menuItem"
        />,
      );

      expect(screen.getByText("Unstar")).toBeInTheDocument();
    });

    it("should toggle when clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: true,
        isStarred: true,
      });

      render(
        <StarStudyButton
          studyId="study-123"
          userId="user-123"
          isStarred={false}
          variant="menuItem"
        />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(toggleStudyStar).toHaveBeenCalledWith("user-123", "study-123");
      });

      await waitFor(() => {
        expect(screen.getByText("Unstar")).toBeInTheDocument();
      });
    });
  });

  describe("event handling", () => {
    it("should stop propagation when clicked", async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();
      vi.mocked(toggleStudyStar).mockResolvedValue({
        success: true,
        isStarred: true,
      });

      render(
        <div onClick={parentClickHandler}>
          <StarStudyButton
            studyId="study-123"
            userId="user-123"
            isStarred={false}
          />
        </div>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });
});
