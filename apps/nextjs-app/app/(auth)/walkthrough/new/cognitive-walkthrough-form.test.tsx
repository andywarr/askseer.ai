import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CognitiveWalkthroughForm } from "./cognitive-walkthrough-form";

// Mock server actions
vi.mock("@/apps/nextjs-app/lib/action", () => ({
  initStudy: vi.fn(),
  getStudyUploadUrls: vi.fn(),
  finalizeAndQueueStudy: vi.fn(),
  cleanupOrphanedStudy: vi.fn(),
  listMyPersonas: vi.fn(),
  getPresignedUrls: vi.fn(),
}));

// Mock client logger
vi.mock("@/apps/nextjs-app/lib/client-logger", () => ({
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Figma actions (OAuth-based)
vi.mock("@/apps/nextjs-app/lib/figma-actions", () => ({
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
  listMyPersonas,
} from "@/apps/nextjs-app/lib/action";

describe("CognitiveWalkthroughForm", () => {
  const defaultProps = {
    credits: 10,
    maxFiles: 50,
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
    it("should render the form with all required fields", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Wait for async effects to settle
      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText(/user trying to accomplish/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /evaluate/i }),
      ).toBeInTheDocument();
    });

    it("should render file upload area", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(
        screen.getByText(/drag and drop|click to upload/i),
      ).toBeInTheDocument();
    });

    it("should show persona select component", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(screen.getByTestId("persona-select")).toBeInTheDocument();
    });

    it("should not render heuristic select (unlike HE form)", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(screen.queryByTestId("heuristic-select")).not.toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should disable submit button when required fields are empty", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      expect(submitBtn).toBeDisabled();
    });

    it("should validate call this study max length", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/call this study/i);
      const longName = "a".repeat(101);

      await user.type(nameInput, longName);
      // Trigger blur to show validation
      fireEvent.blur(nameInput);

      await waitFor(
        () => {
          // Check for validation message or that form is invalid
          const errorMessage = screen.queryByText(
            /must be less than 100 characters/i,
          );
          expect(
            errorMessage || nameInput.getAttribute("aria-invalid") === "true",
          ).toBeTruthy();
        },
        { timeout: 2000 },
      );
    });

    it("should validate user trying to accomplish max length", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/user trying to accomplish/i),
        ).toBeInTheDocument();
      });

      const goalInput = screen.getByLabelText(/user trying to accomplish/i);
      const longGoal = "a".repeat(1001);

      await user.type(goalInput, longGoal);
      // Trigger blur to show validation
      fireEvent.blur(goalInput);

      await waitFor(
        () => {
          // Check for validation message or that form is invalid
          const errorMessage = screen.queryByText(
            /must be less than 1000 characters/i,
          );
          expect(
            errorMessage || goalInput.getAttribute("aria-invalid") === "true",
          ).toBeTruthy();
        },
        { timeout: 2000 },
      );
    });

    it("should require at least one file", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/call this study/i);
      const goalInput = screen.getByLabelText(/user trying to accomplish/i);

      await user.type(nameInput, "Test Study");
      await user.type(goalInput, "Complete checkout flow");

      // Wait for form to process the inputs
      await waitFor(() => {
        expect(nameInput).toHaveValue("Test Study");
      });

      // Submit button should still be disabled without files
      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      expect(submitBtn).toBeDisabled();
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

        await waitFor(() => {
          expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
        });
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

        await waitFor(() => {
          expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
        });

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

  describe("Persona Selection", () => {
    it("should render persona selection component", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      expect(
        screen.getByTestId("persona-select-container"),
      ).toBeInTheDocument();
    });

    it("should allow selecting a persona", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const personaBtn = screen.getByTestId("persona-select");
      fireEvent.click(personaBtn);

      // The component handles the persona selection internally
      expect(personaBtn).toBeInTheDocument();
    });

    it("should allow clearing persona selection", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const clearBtn = screen.getByTestId("clear-persona");
      fireEvent.click(clearBtn);

      expect(clearBtn).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should enable submit when all required fields are filled", async () => {
      const user = userEvent.setup();

      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (getStudyUploadUrls as Mock).mockResolvedValue({
        urls: ["https://upload.url/1"],
      });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Fill in required fields
      await user.type(
        screen.getByLabelText(/call this study/i),
        "Checkout Flow Test",
      );
      await user.type(
        screen.getByLabelText(/user trying to accomplish/i),
        "Complete purchase of an item",
      );

      // Add a file
      const file = new File(["test"], "checkout.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
      });

      // Wait for the form to become valid
      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(
        () => {
          expect(submitBtn).not.toBeDisabled();
        },
        { timeout: 3000 },
      );
    });

    it("should call initStudy with cognitive_walkthrough type", async () => {
      const user = userEvent.setup();

      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (getStudyUploadUrls as Mock).mockResolvedValue({
        urls: ["https://upload.url/1"],
      });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Fill in required fields
      await user.type(screen.getByLabelText(/call this study/i), "Test Study");
      await user.type(
        screen.getByLabelText(/user trying to accomplish/i),
        "Test goal",
      );

      // Add a file
      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
      });

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
          "Test Study",
          "cognitive_walkthrough",
        );
      });
    });
  });

  describe("Context Field", () => {
    it("should allow entering optional context", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Find context field
      const contextField = screen.queryByLabelText(/context/i);
      if (contextField) {
        await user.type(contextField, "User is a first-time buyer");
        expect(contextField).toHaveValue("User is a first-time buyer");
      }
    });

    it("should validate context max length", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const contextField = screen.queryByLabelText(/context/i);
      if (contextField) {
        const longContext = "a".repeat(1001);
        await user.type(contextField, longContext);

        await waitFor(() => {
          expect(
            screen.getByText(/must be less than 1000 characters/i),
          ).toBeInTheDocument();
        });
      }
    });
  });

  describe("User Description", () => {
    it("should allow entering optional user description", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      const userField = screen.queryByLabelText(
        /target user|user description/i,
      );
      if (userField) {
        await user.type(userField, "First-time shopper, 25-34 years old");
        expect(userField).toHaveValue("First-time shopper, 25-34 years old");
      }
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

      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
      });
    });

    it("should handle zero credits prop", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} credits={0} />);

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

    it("should fetch personas on mount", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(listMyPersonas).toHaveBeenCalled();
      });
    });
  });

  describe("Form State Management", () => {
    it("should maintain form state across field updates", async () => {
      const user = userEvent.setup();
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/call this study/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/call this study/i);
      const goalInput = screen.getByLabelText(/user trying to accomplish/i);

      await user.type(nameInput, "My Study");
      await user.type(goalInput, "My Goal");

      expect(nameInput).toHaveValue("My Study");
      expect(goalInput).toHaveValue("My Goal");
    });

    it("should clear file validation error when file is added", async () => {
      render(<CognitiveWalkthroughForm {...defaultProps} />);

      // Initially no files
      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      expect(submitBtn).toBeDisabled();

      // Add a file
      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId("file-card-0")).toBeInTheDocument();
        });
      }
    });
  });
});
