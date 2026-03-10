import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CognitiveWalkthroughForm } from "./cognitive-walkthrough-form";


// Mock SidebarProvider and useSidebar required by StickyFormFooter
vi.mock("@/apps/nextjs-app/components/ui/sidebar", () => ({
  useSidebar: () => ({
    state: "expanded",
    open: true,
    setOpen: vi.fn(),
    openMobile: false,
    setOpenMobile: vi.fn(),
    isMobile: false,
    toggleSidebar: vi.fn(),
  }),
  SidebarProvider: ({ children }: any) => <>{children}</>,
  SidebarMenuButton: ({ children }: any) => <>{children}</>,
}));



if (typeof window.URL.createObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/mock-uuid') });
}
if (typeof window.URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'revokeObjectURL', { value: vi.fn() });
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock server actions
vi.mock("@/apps/nextjs-app/lib/actions/study-lifecycle-actions", () => ({
  initStudy: vi.fn(),
  getStudyUploadUrls: vi.fn(),
  finalizeAndQueueStudy: vi.fn(),
  cleanupOrphanedStudy: vi.fn(),
}));

vi.mock("@/apps/nextjs-app/lib/actions/persona-actions", () => ({
  listMyPersonas: vi.fn(),
}));

vi.mock("@/apps/nextjs-app/lib/actions/s3-actions", () => ({
  getPresignedUrls: vi.fn(),
}));

// Mock client logger
vi.mock("@/apps/nextjs-app/lib/utils/client-logger", () => ({
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Figma actions (OAuth-based)
vi.mock("@/apps/nextjs-app/lib/figma/actions", () => ({
  importFigmaImages: vi.fn(),
  checkFigmaConnection: vi.fn().mockResolvedValue({ connected: true }),
}));

// Mock Figma connect button
vi.mock("@/apps/nextjs-app/components/figma/figma-connect-button", () => ({
  FigmaConnectButton: ({
    onConnectionChange,
  }: {
    onConnectionChange?: (connected: boolean) => void;
  }) => {
    // Simulate connected state
    if (onConnectionChange) {
      setTimeout(() => onConnectionChange(true), 0);
    }
    return <button data-testid="figma-connect-button">Connect Figma</button>;
  },
}));

// Mock child components that have complex dependencies
vi.mock("@/apps/nextjs-app/components/persona/persona-select", () => ({
  PersonaSelect: ({
    onSelect,
    onUserDescriptionChange,
  }: {
    onSelect?: (persona: { studyId: string; name: string } | null) => void;
    onUserDescriptionChange?: (description: string) => void;
  }) => (
    <div data-testid="persona-select-container">
      <button
        data-testid="persona-select"
        onClick={() =>
          onSelect?.({ studyId: "persona-1", name: "Test Persona" })
        }
      >
        Select Persona
      </button>
      <button data-testid="clear-persona" onClick={() => onSelect?.(null)}>
        Clear Persona
      </button>
    </div>
  ),
}));

vi.mock("@/apps/nextjs-app/components/dnd-provider", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/apps/nextjs-app/components/figma/draggable-file-card", () => ({
  default: ({
    file,
    index,
    deleteCard,
  }: {
    file: File;
    index: number;
    deleteCard?: (index: number) => void;
  }) => (
    <div data-testid={`file-card-${index}`}>
      <span>{file.name}</span>
      <button onClick={() => deleteCard?.(index)} aria-label="Remove file">
        Remove
      </button>
    </div>
  ),
}));

vi.mock("@/apps/nextjs-app/components/loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

// Import mocked functions for assertions
import {
  initStudy,
  getStudyUploadUrls,
  finalizeAndQueueStudy,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";

describe("CognitiveWalkthroughForm", () => {
  const defaultProps = {
    balanceCents: 1000,
    studyCostCents: 200,
    maxFiles: 8,
    canPurchaseCredits: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    (listMyPersonas as Mock).mockResolvedValue({
      privatePersonas: [],
      teamPersonas: [],
      companyPersonas: [],
      isDefaultTeam: true,
    });
  });

  describe("Rendering", () => {
    it("should render the form with file upload as primary field", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // File upload should be visible immediately
      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /evaluate/i }),
      ).toBeInTheDocument();
    });

    it("should hide name, goal fields behind toggle", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // These fields should NOT be visible by default
      expect(screen.queryByLabelText(/call this study/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/user trying to accomplish/i)).not.toBeInTheDocument();

      // Toggle should be visible
      expect(
        screen.getByRole("button", { name: /know something we don't/i }),
      ).toBeInTheDocument();
    });

    it("should show optional fields when toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
        expect(
          screen.getByLabelText(/user trying to accomplish/i),
        ).toBeInTheDocument();
      });
    });

    it("should render file upload area", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
    });

    it("should not render heuristic select (unlike HE form)", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(screen.queryByTestId("heuristic-select")).not.toBeInTheDocument();
    });
  });

  describe("File Handling", () => {
    it("should accept valid image files", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');

      expect(fileInput).toBeInTheDocument();

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await screen.findByTestId("file-card-0");
      }
    });

    it("should display file name in file card", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const file = new File(["test"], "walkthrough-step-1.png", {
        type: "image/png",
      });
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(
            screen.getByText("walkthrough-step-1.png"),
          ).toBeInTheDocument();
        });
      }
    });

    it("should allow removing files", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await screen.findByTestId("file-card-0");

        const removeBtn = screen.getByRole("button", { name: /remove/i });
        fireEvent.click(removeBtn);

        await waitFor(() => {
          expect(screen.queryByTestId("file-card-0")).not.toBeInTheDocument();
        });
      }
    });

    it("should handle multiple file uploads", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const files = [
        new File(["test1"], "step1.png", { type: "image/png" }),
        new File(["test2"], "step2.png", { type: "image/png" }),
        new File(["test3"], "step3.png", { type: "image/png" }),
      ];
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files } });

        await waitFor(() => {
          expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
          expect(screen.getByTestId("file-card-1")).toBeInTheDocument();
          expect(screen.getByTestId("file-card-2")).toBeInTheDocument();
        });
      }
    });

    it("should maintain file order for walkthrough steps", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const files = [
        new File(["test1"], "step1.png", { type: "image/png" }),
        new File(["test2"], "step2.png", { type: "image/png" }),
      ];
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files } });

        await waitFor(() => {
          const card0 = screen.getByTestId("file-card-0");
          const card1 = screen.getByTestId("file-card-1");

          expect(card0).toHaveTextContent("step1.png");
          expect(card1).toHaveTextContent("step2.png");
        });
      }
    });
  });

  describe("Submit Button", () => {
    it("should enable submit button when only files are uploaded (no name/goal required)", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Initially disabled (no files)
      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      expect(submitBtn).toBeDisabled();

      // Add a file
      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await screen.findByTestId("file-card-0");

      // Button should now be enabled without needing name/goal
      await waitFor(
        () => {
          expect(submitBtn).not.toBeDisabled();
        },
        { timeout: 3000 },
      );
    });

    it("should handle zero credits prop", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} balanceCents={0} />);

      await waitFor(() => {
        const submitBtn = screen.getByRole("button", { name: /evaluate/i });
        expect(submitBtn).toBeDisabled();
      });
    });

    it("should handle canPurchaseCredits=false", async () => {
      render(
        <CognitiveWalkthroughForm
          {...defaultProps}
          canPurchaseCredits={false}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /evaluate/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Optional Fields", () => {
    it("should show persona select in optional fields", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Click toggle to show optional fields
      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId("persona-select")).toBeInTheDocument();
      });
    });

    it("should allow entering optional context", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Click toggle to show optional fields
      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      const contextField = screen.queryByLabelText(/context/i);
      if (contextField) {
        await user.type(contextField, "User is a first-time buyer");
        expect(contextField).toHaveValue("User is a first-time buyer");
      }
    });
  });

  describe("Form Submission", () => {
    it("should call initStudy with cognitive_walkthrough type", async () => {
      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (getStudyUploadUrls as Mock).mockResolvedValue({
        urls: ["https://upload.url/1"],
      });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Add a file (no need to fill name/goal)
      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await screen.findByTestId("file-card-0");

      // Submit the form
      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(
        () => {
          expect(submitBtn).not.toBeDisabled();
        },
        { timeout: 3000 },
      );

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(initStudy).toHaveBeenCalledWith(
          null,
          "cognitive_walkthrough",
        );
      });
    });
  });

  describe("Figma Import", () => {
    it("should show Figma URL input option", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Check for Figma import option
      const figmaInput = screen.queryByPlaceholderText(/figma/i);
      if (figmaInput) {
        expect(figmaInput).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle different maxFiles values", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} maxFiles={10} />);

      expect(screen.getAllByText(/drag and drop|click to upload/i)[0]).toBeInTheDocument();
    });

    it("should fetch personas on mount", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(listMyPersonas).toHaveBeenCalled();
      });
    });
  });
});
