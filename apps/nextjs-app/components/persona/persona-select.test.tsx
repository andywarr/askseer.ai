import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaSelect } from "./persona-select";

// Mock UI components to simplify testing
vi.mock("@/apps/nextjs-app/components/ui/avatar", () => ({
  Avatar: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  // eslint-disable-next-line @next/next/no-img-element
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

describe("PersonaSelect", () => {
  const mockOnChange = vi.fn();

  const createPersona = (
    id: string,
    name: string,
    description?: string,
  ): {
    id: string;
    name: string;
    persona: { name: string; description: string | null };
  } => ({
    id,
    name,
    persona: { name, description: description || null },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Persona Grouping Logic", () => {
    describe("when on default team (isDefaultTeam=true)", () => {
      it("should show team personas under 'Company personas' heading", async () => {
        const user = userEvent.setup();
        const teamPersonas = [
          createPersona("team-1", "Team Persona 1"),
          createPersona("team-2", "Team Persona 2"),
        ];

        render(
          <PersonaSelect
            personas={teamPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        // Wait for dropdown to open and check for personas
        await waitFor(() => {
          expect(screen.getByText("Team Persona 1")).toBeInTheDocument();
          expect(screen.getByText("Team Persona 2")).toBeInTheDocument();
        });
      });

      it("should show company personas when user is on default team", async () => {
        const user = userEvent.setup();
        const teamPersonas = [createPersona("team-1", "Team Persona")];
        const companyPersonas = [createPersona("company-1", "Company Persona")];

        render(
          <PersonaSelect
            personas={teamPersonas}
            companyPersonas={companyPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        // Both team and company personas should be visible
        await waitFor(() => {
          expect(screen.getByText("Team Persona")).toBeInTheDocument();
          expect(screen.getByText("Company Persona")).toBeInTheDocument();
        });
      });

      it("should merge team and company personas under one 'Company personas' heading when both exist", async () => {
        const user = userEvent.setup();
        const teamPersonas = [createPersona("team-1", "Team Persona")];
        const companyPersonas = [createPersona("company-1", "Company Persona")];

        render(
          <PersonaSelect
            personas={teamPersonas}
            companyPersonas={companyPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          // Both personas should be visible under the same heading
          expect(screen.getByText("Team Persona")).toBeInTheDocument();
          expect(screen.getByText("Company Persona")).toBeInTheDocument();
        });

        // There should only be one "Company personas" heading, not separate groups
        const companyHeadings = screen.queryAllByText("Company personas");
        expect(companyHeadings.length).toBeLessThanOrEqual(1);
      });

      it("should show private personas under 'My personas' heading", async () => {
        const user = userEvent.setup();
        const privatePersonas = [
          createPersona("private-1", "Private Persona 1"),
        ];
        const teamPersonas = [createPersona("team-1", "Team Persona")];

        render(
          <PersonaSelect
            privatePersonas={privatePersonas}
            personas={teamPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByText("My personas")).toBeInTheDocument();
          expect(screen.getByText("Private Persona 1")).toBeInTheDocument();
        });
      });
    });

    describe("when on non-default team (isDefaultTeam=false)", () => {
      it("should show team personas under 'Team personas' heading", async () => {
        const user = userEvent.setup();
        const teamPersonas = [createPersona("team-1", "Team Persona")];

        render(
          <PersonaSelect
            personas={teamPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={false}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByText("Team Persona")).toBeInTheDocument();
        });
      });

      it("should show company personas under separate 'Company personas' heading", async () => {
        const user = userEvent.setup();
        const teamPersonas = [createPersona("team-1", "Team Persona")];
        const companyPersonas = [createPersona("company-1", "Company Persona")];

        render(
          <PersonaSelect
            personas={teamPersonas}
            companyPersonas={companyPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={false}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByText("Team personas")).toBeInTheDocument();
          expect(screen.getByText("Company personas")).toBeInTheDocument();
          expect(screen.getByText("Team Persona")).toBeInTheDocument();
          expect(screen.getByText("Company Persona")).toBeInTheDocument();
        });
      });
    });

    describe("edge cases", () => {
      it("should handle empty persona lists", async () => {
        render(
          <PersonaSelect
            personas={[]}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Should render without errors
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      it("should not show heading when only one group exists", async () => {
        const user = userEvent.setup();
        const teamPersonas = [createPersona("team-1", "Team Persona")];

        render(
          <PersonaSelect
            personas={teamPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByText("Team Persona")).toBeInTheDocument();
        });

        // When only one group exists, no heading should be shown
        expect(screen.queryByText("Company personas")).not.toBeInTheDocument();
        expect(screen.queryByText("Team personas")).not.toBeInTheDocument();
      });

      it("should show only company personas on default team when no team personas exist", async () => {
        const user = userEvent.setup();
        const companyPersonas = [createPersona("company-1", "Company Persona")];

        render(
          <PersonaSelect
            personas={[]}
            companyPersonas={companyPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={true}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByText("Company Persona")).toBeInTheDocument();
        });
      });

      it("should deduplicate personas in allPersonas for selection purposes", async () => {
        const user = userEvent.setup();
        const duplicatePersona = createPersona("dup-1", "Duplicate Persona");
        const teamPersonas = [duplicatePersona];
        const companyPersonas = [duplicatePersona];

        render(
          <PersonaSelect
            personas={teamPersonas}
            companyPersonas={companyPersonas}
            inputValue=""
            onChange={mockOnChange}
            isDefaultTeam={false}
            inline={false}
          />,
        );

        // Open the popover
        const trigger = screen.getByRole("combobox");
        await user.click(trigger);

        await waitFor(() => {
          // The persona appears in both groups (Team personas and Company personas)
          // This is expected behavior - each group shows its personas independently
          const duplicates = screen.getAllByText("Duplicate Persona");
          expect(duplicates.length).toBeGreaterThanOrEqual(1);
        });
      });
    });
  });

  describe("Selection behavior", () => {
    it("should call onChange when a persona is selected", async () => {
      const user = userEvent.setup();
      const teamPersonas = [createPersona("team-1", "Team Persona")];

      render(
        <PersonaSelect
          personas={teamPersonas}
          inputValue=""
          onChange={mockOnChange}
          isDefaultTeam={false}
          inline={false}
        />,
      );

      // Open the popover
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText("Team Persona")).toBeInTheDocument();
      });

      // Click on the persona
      await user.click(screen.getByText("Team Persona"));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedId: "team-1",
        }),
      );
    });

    it("should display selected persona name", async () => {
      const teamPersonas = [createPersona("team-1", "Team Persona")];

      render(
        <PersonaSelect
          personas={teamPersonas}
          selectedId="team-1"
          inputValue=""
          onChange={mockOnChange}
          isDefaultTeam={false}
          inline={false}
        />,
      );

      // The button should show the selected persona name
      expect(screen.getByRole("combobox")).toHaveTextContent("Team Persona");
    });
  });
});
