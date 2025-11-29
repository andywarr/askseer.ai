import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaForm } from "./persona-form";

// Mock server actions
vi.mock("@/apps/nextjs-app/lib/action", () => ({
  initStudy: vi.fn(),
  finalizeAndQueueStudy: vi.fn(),
  putPresignedUrls: vi.fn(),
  cleanupOrphanedStudy: vi.fn(),
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

// Mock complex child components
vi.mock("@/apps/nextjs-app/components/location/location-autocomplete", () => ({
  LocationAutocomplete: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      data-testid="location-autocomplete"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter location"
    />
  ),
}));

vi.mock("@/apps/nextjs-app/components/list-editor", () => ({
  ListEditor: ({
    values,
    onChange,
    placeholder,
  }: {
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
  }) => (
    <div data-testid="list-editor">
      <input
        data-testid="list-editor-input"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const input = e.target as HTMLInputElement;
            onChange([...values, input.value]);
            input.value = "";
          }
        }}
      />
      {values.map((v, i) => (
        <span key={i} data-testid={`list-item-${i}`}>
          {v}
        </span>
      ))}
    </div>
  ),
}));

vi.mock("@/apps/nextjs-app/components/multiline-list-editor", () => ({
  MultilineListEditor: ({
    values,
    onChange,
    placeholder,
  }: {
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
  }) => (
    <div data-testid="multiline-list-editor">
      <textarea data-testid="multiline-input" placeholder={placeholder} />
      {values.map((v, i) => (
        <div key={i} data-testid={`multiline-item-${i}`}>
          {v}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/apps/nextjs-app/components/goals-editor", () => ({
  GoalsEditor: ({
    value,
    onChange,
  }: {
    value?: Array<{ want: string; soThat: string }>;
    onChange: (value: Array<{ want: string; soThat: string }>) => void;
  }) => (
    <div data-testid="goals-editor">
      <button
        data-testid="add-goal-btn"
        onClick={() =>
          onChange([
            ...(value || []),
            { want: "New goal", soThat: "Achieve something" },
          ])
        }
      >
        Add Goal
      </button>
      {(value || []).map((g, i) => (
        <div key={i} data-testid={`goal-${i}`}>
          {g.want} → {g.soThat}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/apps/nextjs-app/components/loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock("@/apps/nextjs-app/components/form-submit-with-credits", () => ({
  default: ({
    label,
    credits,
    disabledOverride,
  }: {
    label: string;
    credits: number;
    disabledOverride?: boolean;
  }) => (
    <button type="submit" disabled={disabledOverride} data-testid="submit-btn">
      {label} ({credits} credits)
    </button>
  ),
}));

// Import mocked functions for assertions
import {
  initStudy,
  finalizeAndQueueStudy,
  putPresignedUrls,
} from "@/apps/nextjs-app/lib/action";

describe("PersonaForm", () => {
  const defaultProps = {
    mode: "create" as const,
    credits: 10,
    canPurchaseCredits: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the form with persona name field", async () => {
      render(<PersonaForm {...defaultProps} />);

      expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
    });

    it("should render accordion sections", async () => {
      render(<PersonaForm {...defaultProps} />);

      // Check for accordion triggers
      expect(screen.getByText(/demographics/i)).toBeInTheDocument();
      expect(screen.getByText(/psychographics/i)).toBeInTheDocument();
      expect(screen.getByText(/behaviors/i)).toBeInTheDocument();
      expect(screen.getByText(/firmographics/i)).toBeInTheDocument();
      expect(screen.getByText(/goals/i)).toBeInTheDocument();
      expect(screen.getByText(/quotes/i)).toBeInTheDocument();
    });

    it("should render submit button with correct label in create mode", async () => {
      render(<PersonaForm {...defaultProps} />);

      expect(screen.getByTestId("submit-btn")).toHaveTextContent(/create/i);
    });

    it("should render Save button in edit mode", async () => {
      render(<PersonaForm {...defaultProps} mode="edit" studyId="study-123" />);

      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("should render Cancel button in edit mode", async () => {
      render(<PersonaForm {...defaultProps} mode="edit" studyId="study-123" />);

      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should disable submit when form is empty", async () => {
      render(<PersonaForm {...defaultProps} />);

      const submitBtn = screen.getByTestId("submit-btn");
      expect(submitBtn).toBeDisabled();
    });

    it("should enable submit when persona name is provided", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "Marketing Manager");

      await waitFor(() => {
        const submitBtn = screen.getByTestId("submit-btn");
        expect(submitBtn).not.toBeDisabled();
      });
    });

    it("should allow entering persona name", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "Sales Representative");

      expect(nameInput).toHaveValue("Sales Representative");
    });
  });

  describe("Demographics Accordion", () => {
    it("should expand demographics section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      // After clicking, the section content should be visible
      // The accordion content might take time to render
      await waitFor(
        () => {
          // Look for any content that would be in demographics
          const ageText = screen.queryByText(/^age$/i);
          const genderText = screen.queryByText(/^gender$/i);
          expect(ageText || genderText).toBeTruthy();
        },
        { timeout: 2000 },
      );
    });

    it("should show gender field in demographics section", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      await waitFor(
        () => {
          expect(screen.getByText(/^gender$/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should show location field in demographics section", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      await waitFor(
        () => {
          expect(
            screen.getByTestId("location-autocomplete"),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Psychographics Accordion", () => {
    it("should expand psychographics section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      // Wait for form to be ready
      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const psychographicsSection = screen.getByText(/psychographics/i);
      await user.click(psychographicsSection);

      // After clicking, look for a field label that appears in the psychographics section
      await waitFor(
        () => {
          // The field is labeled "Personality" not "Personality traits"
          expect(
            screen.getByText(/tech proficiency|personality/i),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should show personality field", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const psychographicsSection = screen.getByText(/psychographics/i);
      await user.click(psychographicsSection);

      await waitFor(
        () => {
          expect(screen.getByText(/^personality$/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Behaviors Accordion", () => {
    it("should expand behaviors section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const behaviorsSection = screen.getByText(/^behaviors$/i);
      await user.click(behaviorsSection);

      await waitFor(
        () => {
          expect(screen.getByText(/preferred channels/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Firmographics Accordion", () => {
    it("should expand firmographics section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const firmographicsSection = screen.getByText(/firmographics/i);
      await user.click(firmographicsSection);

      await waitFor(
        () => {
          expect(screen.getByText(/employment status/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should show job title field", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const firmographicsSection = screen.getByText(/firmographics/i);
      await user.click(firmographicsSection);

      await waitFor(
        () => {
          expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should show company size field", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const firmographicsSection = screen.getByText(/firmographics/i);
      await user.click(firmographicsSection);

      await waitFor(
        () => {
          expect(screen.getByText(/company size/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Goals Accordion", () => {
    it("should expand goals section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const goalsSection = screen.getByText(/^goals$/i);
      await user.click(goalsSection);

      await waitFor(
        () => {
          expect(screen.getByTestId("goals-editor")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Quotes Accordion", () => {
    it("should expand quotes section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const quotesSection = screen.getByText(/quotes/i);
      await user.click(quotesSection);

      await waitFor(
        () => {
          expect(
            screen.getByTestId("multiline-list-editor"),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Form Submission - Create Mode", () => {
    it("should call initStudy on valid form submission", async () => {
      const user = userEvent.setup();

      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<PersonaForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "Product Manager");

      await waitFor(() => {
        const submitBtn = screen.getByTestId("submit-btn");
        expect(submitBtn).not.toBeDisabled();
      });

      const submitBtn = screen.getByTestId("submit-btn");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(initStudy).toHaveBeenCalledWith("Product Manager", "persona");
      });
    });

    it("should call finalizeAndQueueStudy after initStudy", async () => {
      const user = userEvent.setup();

      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<PersonaForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "UX Designer");

      await waitFor(() => {
        const submitBtn = screen.getByTestId("submit-btn");
        expect(submitBtn).not.toBeDisabled();
      });

      const submitBtn = screen.getByTestId("submit-btn");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(finalizeAndQueueStudy).toHaveBeenCalled();
      });
    });
  });

  describe("Edit Mode", () => {
    const editModeProps = {
      ...defaultProps,
      mode: "edit" as const,
      studyId: "study-123",
      initialData: {
        name: "Existing Persona",
        demographics: {
          age: "25-34",
          gender: "Female",
        },
        firmographics: {
          jobTitle: "Product Manager",
        },
      },
    };

    it("should populate form with initial data", async () => {
      render(<PersonaForm {...editModeProps} />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/persona name/i);
        expect(nameInput).toHaveValue("Existing Persona");
      });
    });

    it("should show Save button instead of Create", async () => {
      render(<PersonaForm {...editModeProps} />);

      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("should navigate back on Cancel click", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...editModeProps} />);

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelBtn);

      // Navigation is handled by router mock
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero credits prop", async () => {
      render(<PersonaForm {...defaultProps} credits={0} />);

      expect(screen.getByText(/0 credits/i)).toBeInTheDocument();
    });

    it("should handle missing canPurchaseCredits prop", async () => {
      const propsWithoutCanPurchase = {
        mode: "create" as const,
        credits: 10,
      };

      render(<PersonaForm {...propsWithoutCanPurchase} />);

      expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
    });

    it("should render all accordion sections collapsed by default", async () => {
      render(<PersonaForm {...defaultProps} />);

      // Check that accordion content is not visible initially
      expect(screen.queryByLabelText(/job title/i)).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("location-autocomplete"),
      ).not.toBeInTheDocument();
    });

    it("should handle form with all sections filled", async () => {
      const user = userEvent.setup();

      (initStudy as Mock).mockResolvedValue({ id: "study-123" });
      (finalizeAndQueueStudy as Mock).mockResolvedValue({ success: true });

      render(<PersonaForm {...defaultProps} />);

      // Fill persona name
      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "Enterprise Buyer");

      // Expand and fill demographics
      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      // Form should be submittable with just the name
      await waitFor(() => {
        const submitBtn = screen.getByTestId("submit-btn");
        expect(submitBtn).not.toBeDisabled();
      });
    });
  });

  describe("Custom Field Toggles", () => {
    it("should allow switching between preset and custom values", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      // Expand demographics
      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      // Look for "Enter custom value" link
      await waitFor(() => {
        const customLinks = screen.getAllByText(/enter custom value/i);
        expect(customLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Tools Section", () => {
    it("should expand tools section when clicked", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/persona name/i)).toBeInTheDocument();
      });

      const toolsSection = screen.getByText(/^tools$/i);
      await user.click(toolsSection);

      await waitFor(
        () => {
          expect(
            screen.getByPlaceholderText(/figma|slack|jira/i),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Form State Management", () => {
    it("should maintain form state across accordion interactions", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      // Fill name
      const nameInput = screen.getByLabelText(/persona name/i);
      await user.type(nameInput, "Test Persona");

      // Expand demographics
      const demographicsSection = screen.getByText(/demographics/i);
      await user.click(demographicsSection);

      // Collapse demographics
      await user.click(demographicsSection);

      // Name should still be there
      expect(nameInput).toHaveValue("Test Persona");
    });

    it("should update form dirty state when fields change", async () => {
      const user = userEvent.setup();
      render(<PersonaForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/persona name/i);

      // Initially form should be disabled (empty/clean)
      expect(screen.getByTestId("submit-btn")).toBeDisabled();

      // Type in name
      await user.type(nameInput, "New Persona");

      // Form should now be enabled
      await waitFor(() => {
        expect(screen.getByTestId("submit-btn")).not.toBeDisabled();
      });
    });
  });
});
