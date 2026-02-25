import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamSelector, type Team } from "./team-selector";

// Mock scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

describe("TeamSelector", () => {
  const mockTeams: Team[] = [
    {
      id: "team-1",
      name: "Engineering Team",
      isPersonal: false,
      balanceCents: 5000,
    },
    { id: "team-2", name: "Design Team", isPersonal: false, balanceCents: 500 },
    {
      id: "team-3",
      name: "Marketing Team",
      isPersonal: false,
      balanceCents: 0,
    },
    {
      id: "personal-1",
      name: "My Personal",
      isPersonal: true,
      balanceCents: 1000,
    },
  ];

  const mockOnTeamSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render with default placeholder", () => {
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      expect(
        screen.getByPlaceholderText("Select or search teams..."),
      ).toBeInTheDocument();
    });

    it("should render with custom placeholder", () => {
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          placeholder="Choose a team"
        />,
      );

      expect(screen.getByPlaceholderText("Choose a team")).toBeInTheDocument();
    });

    it("should show empty placeholder when no teams", () => {
      render(
        <TeamSelector
          teams={[]}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      expect(
        screen.getByPlaceholderText("No eligible teams"),
      ).toBeInTheDocument();
    });

    it("should show custom empty placeholder", () => {
      render(
        <TeamSelector
          teams={[]}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          emptyPlaceholder="No teams available"
        />,
      );

      expect(
        screen.getByPlaceholderText("No teams available"),
      ).toBeInTheDocument();
    });

    it("should display selected team name", () => {
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId="team-1"
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      expect(screen.getByDisplayValue("Engineering Team")).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          disabled
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      expect(input).toBeDisabled();
    });
  });

  describe("Team Selection", () => {
    it("should show team list when clicked", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText("Engineering Team")).toBeInTheDocument();
      expect(screen.getByText("Design Team")).toBeInTheDocument();
    });

    it("should call onTeamSelect when team is selected", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      const teamOption = screen.getByText("Engineering Team");
      await user.click(teamOption);

      expect(mockOnTeamSelect).toHaveBeenCalledWith("team-1");
    });

    it("should auto-select team when only one team exists", async () => {
      const singleTeam = [mockTeams[0]];
      render(
        <TeamSelector
          teams={singleTeam}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      await waitFor(() => {
        expect(mockOnTeamSelect).toHaveBeenCalledWith("team-1");
      });
    });

    it("should not auto-select when team is already selected", async () => {
      const singleTeam = [mockTeams[0]];
      render(
        <TeamSelector
          teams={singleTeam}
          selectedTeamId="team-1"
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      await waitFor(() => {
        expect(mockOnTeamSelect).not.toHaveBeenCalled();
      });
    });
  });

  describe("Team Groups", () => {
    it("should separate teams into regular and personal groups", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText("Teams")).toBeInTheDocument();
      expect(screen.getByText("Personal")).toBeInTheDocument();
    });

    it("should not show Teams heading when no regular teams", async () => {
      const user = userEvent.setup();
      const personalOnly = mockTeams.filter((t) => t.isPersonal);
      render(
        <TeamSelector
          teams={personalOnly}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.queryByText("Teams")).not.toBeInTheDocument();
      expect(screen.getByText("Personal")).toBeInTheDocument();
    });
  });

  describe("Balance Display", () => {
    it("should display balance for each team", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText("$50.00")).toBeInTheDocument();
      expect(screen.getByText("$5.00")).toBeInTheDocument();
    });

    it("should display dollar amount for small balance", async () => {
      const user = userEvent.setup();
      const teamsWithOne = [
        { id: "team-1", name: "Team A", isPersonal: false, balanceCents: 100 },
      ];
      render(
        <TeamSelector
          teams={teamsWithOne}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText("$1.00")).toBeInTheDocument();
    });

    it("should show 'remaining' when showCreditsRemaining is true", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          showCreditsRemaining
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
      expect(screen.getAllByText(/remaining/).length).toBeGreaterThan(0);
    });

    it("should apply red color when balance is below study cost", async () => {
      const user = userEvent.setup();
      const lowBalanceTeam = [
        {
          id: "team-1",
          name: "Low Balance Team",
          isPersonal: false,
          balanceCents: 100,
        },
      ];
      render(
        <TeamSelector
          teams={lowBalanceTeam}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      const balanceSpan = screen.getByText("$1.00");
      expect(balanceSpan).toHaveClass("text-red-500");
    });

    it("should apply amber color when balance covers one study but less than two", async () => {
      const user = userEvent.setup();
      const mediumBalanceTeam = [
        {
          id: "team-1",
          name: "Medium Balance Team",
          isPersonal: false,
          balanceCents: 300,
        },
      ];
      render(
        <TeamSelector
          teams={mediumBalanceTeam}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      const balanceSpan = screen.getByText("$3.00");
      expect(balanceSpan).toHaveClass("text-amber-500");
    });
  });

  describe("Zero Balance Handling", () => {
    it("should disable teams with zero balance when disableZeroBalance is true", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          disableZeroBalance
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      // Marketing Team has 0 balance
      const zeroBalanceOption = screen
        .getByText("Marketing Team")
        .closest("[cmdk-item]");
      expect(zeroBalanceOption).toHaveClass("opacity-50");
    });

    it("should not call onTeamSelect when clicking disabled team", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
          disableZeroBalance
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);

      const zeroBalanceOption = screen.getByText("Marketing Team");
      await user.click(zeroBalanceOption);

      expect(mockOnTeamSelect).not.toHaveBeenCalledWith("team-3");
    });
  });

  describe("Search Functionality", () => {
    it("should filter teams based on search input", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);
      await user.type(input, "Engineering");

      expect(screen.getByText("Engineering Team")).toBeInTheDocument();
    });

    it("should show 'No team found' when search has no results", async () => {
      const user = userEvent.setup();
      render(
        <TeamSelector
          teams={mockTeams}
          selectedTeamId=""
          onTeamSelect={mockOnTeamSelect}
        />,
      );

      const input = screen.getByPlaceholderText("Select or search teams...");
      await user.click(input);
      await user.type(input, "Nonexistent Team");

      expect(screen.getByText("No team found.")).toBeInTheDocument();
    });
  });
});
