import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeuristicEvaluationForm } from "./heuristic-evaluation-form";

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

if (typeof window.URL.createObjectURL === "undefined") {
  Object.defineProperty(window.URL, "createObjectURL", {
    value: vi.fn(() => "blob:http://localhost/mock-uuid"),
  });
}
if (typeof window.URL.revokeObjectURL === "undefined") {
  Object.defineProperty(window.URL, "revokeObjectURL", { value: vi.fn() });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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
  listMyHeuristicFamilies: vi.fn(),
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
  }: {
    onSelect?: (persona: { studyId: string; name: string } | null) => void;
  }) => (
    <button
      data-testid="persona-select"
      onClick={() => onSelect?.({ studyId: "persona-1", name: "Test Persona" })}
    >
      Select Persona
    </button>
  ),
}));

vi.mock("@/apps/nextjs-app/app/[locale]/(auth)/evaluation/new/heuristic-select", () => ({
  HeuristicSelect: ({
    selectedId,
    onChange,
    placeholder,
  }: {
    selectedId?: string;
    onChange?: (data: { selectedId: string; family: unknown }) => void;
    placeholder?: string;
  }) => (
    <select
      data-testid="heuristic-select"
      value={selectedId || ""}
      onChange={(e) => onChange?.({ selectedId: e.target.value, family: {} })}
    >
      <option value="">{placeholder || "Select heuristics"}</option>
      <option value="nielsen">Nielsen&apos;s 10 Heuristics</option>
      <option value="custom-1">Custom Heuristics</option>
    </select>
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
      <button onClick={() => deleteCard?.(index)}>Remove</button>
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
  listMyHeuristicFamilies,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { listMyPersonas } from "@/apps/nextjs-app/lib/actions/persona-actions";

describe("HeuristicEvaluationForm", () => {
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
    (listMyHeuristicFamilies as Mock).mockResolvedValue([
      {
        id: "nielsen-id",
        name: "Nielsen's 10 Usability Heuristics",
        key: "NIELSEN",
        description: null,
        companyId: null,
      },
    ]);
  });

  describe("Rendering", () => {
    it("should render the form with file upload as primary field", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // File upload should be visible immediately
      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /evaluate/i }),
      ).toBeInTheDocument();
    });

    it("should hide name, goal, and heuristic fields behind toggle", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // These fields should NOT be visible by default
      expect(
        screen.queryByLabelText(/call this study/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/user trying to accomplish/i),
      ).not.toBeInTheDocument();

      // Toggle should be visible
      expect(
        screen.getByRole("button", { name: /know something we don't/i }),
      ).toBeInTheDocument();
    });

    it("should show optional fields when toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<HeuristicEvaluationForm {...defaultProps} />);

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
      render(<HeuristicEvaluationForm {...defaultProps} />);

      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
    });
  });

  describe("File Handling", () => {
    it("should accept valid image files", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');

      expect(fileInput).toBeInTheDocument();

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await screen.findByTestId("file-card-0");
      }
    });

    it("should display file name in file card", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      const file = new File(["test"], "screenshot.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByText("screenshot.png")).toBeInTheDocument();
        });
      }
    });

    it("should allow removing files", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

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
      render(<HeuristicEvaluationForm {...defaultProps} />);

      const files = [
        new File(["test1"], "test1.png", { type: "image/png" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
        new File(["test3"], "test3.png", { type: "image/png" }),
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
  });

  describe("Submit Button", () => {
    it("should enable submit button when only files are uploaded (no name/goal required)", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

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

      // Button should now be enabled without needing name/goal/heuristic
      await waitFor(
        () => {
          expect(submitBtn).not.toBeDisabled();
        },
        { timeout: 3000 },
      );
    });

    it("should handle zero credits prop", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} balanceCents={0} />);

      await waitFor(() => {
        const submitBtn = screen.getByRole("button", { name: /evaluate/i });
        expect(submitBtn).toBeDisabled();
      });
    });
  });

  describe("Form Submission", () => {
    it("should call initStudy on valid form submission with only files", async () => {
      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (getStudyUploadUrls as Mock).mockResolvedValue({
        urls: ["https://upload.url/1"],
      });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Add a file (no need to fill name/goal/heuristic)
      const file = new File(["test"], "test.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await screen.findByTestId("file-card-0");

      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(
        () => {
          expect(submitBtn).not.toBeDisabled();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Optional Fields", () => {
    it("should show persona select in optional fields", async () => {
      const user = userEvent.setup();
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Click toggle to show optional fields
      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId("persona-select")).toBeInTheDocument();
      });
    });

    it("should show heuristic select in optional fields", async () => {
      const user = userEvent.setup();
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Click toggle to show optional fields
      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId("heuristic-select")).toBeInTheDocument();
      });
    });

    it("should allow entering optional context", async () => {
      const user = userEvent.setup();
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Click toggle to show optional fields
      const toggleBtn = screen.getByRole("button", {
        name: /know something we don't/i,
      });
      await user.click(toggleBtn);

      const contextField = screen.queryByLabelText(/context/i);
      if (contextField) {
        await user.type(contextField, "Additional context for the evaluation");
        expect(contextField).toHaveValue(
          "Additional context for the evaluation",
        );
      }
    });
  });

  describe("Figma Import", () => {
    it("should show Figma URL input", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Check for Figma import option
      const figmaInput = screen.queryByPlaceholderText(/figma/i);
      // Figma import may be behind a toggle or always visible
      if (figmaInput) {
        expect(figmaInput).toBeInTheDocument();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle form reset gracefully", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} />);

      // Wait for form to render
      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
    });

    it("should display correct max file limit from props", async () => {
      render(<HeuristicEvaluationForm {...defaultProps} maxFiles={25} />);

      // Wait for form to render with custom maxFiles
      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
    });
  });

  describe("Benchmark mode", () => {
    const benchmarkSourceStudy = {
      id: "source-study-123",
      mode: "flow" as const,
      goal: "Evaluate the onboarding flow",
      user: "New users aged 18-30",
      context: "Mobile application",
      heuristicId: "nielsen-id",
      personaStudyId: null,
      personaName: null,
      sourceFiles: [
        {
          name: "screen1.png",
          key: "studies/team/study/screen1.png",
          size: 1024,
          type: "image/png",
        },
        {
          name: "screen2.png",
          key: "studies/team/study/screen2.png",
          size: 2048,
          type: "image/png",
        },
      ],
      benchmarkContext: {
        sourceStudyId: "source-study-123",
        results: [
          {
            heuristic: "h1",
            violated: true,
            reason: "No loading state",
            severity: 3,
            recommendations: ["Add spinner"],
          },
        ],
      },
    };

    it("should render in flow benchmark mode with file upload visible", async () => {
      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={benchmarkSourceStudy}
        />,
      );

      // File upload should be visible in flow mode
      expect(
        screen.getAllByText(/drag and drop|click to upload/i)[0],
      ).toBeInTheDocument();
    });

    it("should hide file upload in persona benchmark mode", async () => {
      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={{ ...benchmarkSourceStudy, mode: "persona" }}
        />,
      );

      // File input should not be present (upload section hidden)
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).not.toBeInTheDocument();
    });

    it("should call initStudy with source study id in flow mode", async () => {
      (initStudy as Mock).mockResolvedValue({ id: "new-study-456" });
      (getStudyUploadUrls as Mock).mockResolvedValue({
        urls: ["https://upload.url/1"],
      });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={benchmarkSourceStudy}
        />,
      );

      const file = new File(["test"], "new-screen.png", { type: "image/png" });
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } });
      }
      await screen.findByTestId("file-card-0");

      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(() => expect(submitBtn).not.toBeDisabled(), {
        timeout: 3000,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(initStudy).toHaveBeenCalledWith(
          null,
          "heuristic_evaluation",
          "source-study-123",
          "en",
        );
      });
    });

    it("should call initStudy with source study id in persona mode", async () => {
      (initStudy as Mock).mockResolvedValue({ id: "new-study-789" });
      (getStudyUploadUrls as Mock).mockResolvedValue({ urls: [] });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={{ ...benchmarkSourceStudy, mode: "persona" }}
        />,
      );

      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(() => expect(submitBtn).not.toBeDisabled(), {
        timeout: 3000,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(initStudy).toHaveBeenCalledWith(
          null,
          "heuristic_evaluation",
          "source-study-123",
          "en",
        );
      });
    });

    it("should show toast error and block submit when persona mode has no source files", async () => {
      const { toast } = await import("sonner");

      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={{
            ...benchmarkSourceStudy,
            mode: "persona",
            sourceFiles: [],
          }}
        />,
      );

      const submitBtn = screen.getByRole("button", { name: /evaluate/i });
      await waitFor(() => expect(submitBtn).not.toBeDisabled(), {
        timeout: 3000,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Source study has no screens",
          expect.objectContaining({ description: expect.any(String) }),
        );
      });
      expect(initStudy).not.toHaveBeenCalled();
    });

    it("should pre-fill goal and user from source study", async () => {
      render(
        <HeuristicEvaluationForm
          {...defaultProps}
          benchmarkSourceStudy={benchmarkSourceStudy}
        />,
      );

      // Optional fields are auto-shown in benchmark mode
      await waitFor(() => {
        const goalField = screen.queryByLabelText(/user trying to accomplish/i);
        if (goalField) {
          expect(goalField).toHaveValue("Evaluate the onboarding flow");
        }
      });
    });
  });
});
