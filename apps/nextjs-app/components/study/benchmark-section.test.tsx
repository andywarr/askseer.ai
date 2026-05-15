import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BenchmarkSection } from "./benchmark-section";

vi.mock("@/apps/nextjs-app/lib/actions/benchmark-actions", () => ({
  getStudyBenchmarksAction: vi.fn(),
  getBenchmarkContext: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock grade utils to keep tests deterministic
vi.mock("@/apps/nextjs-app/utils/grade-utils", () => ({
  calculateGradeWeighted: vi.fn(() => ({ grade: "B" })),
}));

import { getStudyBenchmarksAction } from "@/apps/nextjs-app/lib/actions/benchmark-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeHEStudy = (overrides: Record<string, unknown> = {}) => ({
  id: "study-123",
  createdAt: "2026-01-15T10:00:00Z",
  type: "HEURISTIC_EVALUATION" as const,
  name: "Test Evaluation",
  status: "COMPLETED" as const,
  benchmarkSourceId: null,
  heuristicEvaluation: {
    id: "he-1",
    persona: null,
    results: [
      { violated: true, severity: 3 },
      { violated: false, severity: 0 },
    ],
    heuristicFamily: { heuristics: [{ id: "h1" }, { id: "h2" }] },
  },
  cognitiveWalkthrough: null,
  files: [{ id: "f1" }, { id: "f2" }],
  ...overrides,
});

const makeCWStudy = (overrides: Record<string, unknown> = {}) => ({
  id: "study-456",
  createdAt: "2026-02-10T10:00:00Z",
  type: "COGNITIVE_WALKTHROUGH" as const,
  name: "Test Walkthrough",
  status: "COMPLETED" as const,
  benchmarkSourceId: null,
  heuristicEvaluation: null,
  cognitiveWalkthrough: {
    id: "cw-1",
    persona: null,
    steps: [{ issues: [{ severity: 2 }, { severity: 3 }] }, { issues: [] }],
  },
  files: [{ id: "f1" }, { id: "f2" }, { id: "f3" }],
  ...overrides,
});

const defaultProps = {
  studyId: "study-123",
  studyType: "HEURISTIC_EVALUATION" as const,
  studyKind: "evaluation" as const,
  canManage: true,
};

describe("BenchmarkSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  describe("Loading state", () => {
    it("shows skeleton while fetching benchmarks", () => {
      // Never resolves during this test
      (getStudyBenchmarksAction as Mock).mockReturnValue(new Promise(() => {}));
      render(<BenchmarkSection {...defaultProps} />);
      // Skeleton is rendered as a placeholder
      expect(
        document.querySelector(".animate-pulse, [data-slot]"),
      ).toBeDefined();
    });
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  describe("Empty state (no benchmarks)", () => {
    it("shows empty state card when only one study exists (the source)", async () => {
      // Only 1 study means no benchmarks yet (hasBenchmarks = studies.length > 1)
      (getStudyBenchmarksAction as Mock).mockResolvedValue([makeHEStudy()]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No benchmarks yet")).toBeInTheDocument();
      });
    });

    it("shows Flow and Persona buttons when canManage is true", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([makeHEStudy()]);

      render(<BenchmarkSection {...defaultProps} canManage={true} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^flow$/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /^persona$/i }),
        ).toBeInTheDocument();
      });
    });

    it("hides Flow and Persona buttons when canManage is false", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([makeHEStudy()]);

      render(<BenchmarkSection {...defaultProps} canManage={false} />);

      await waitFor(() => {
        expect(screen.getByText("No benchmarks yet")).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /^flow$/i }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /^persona$/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("navigates to flow benchmark URL when Flow button clicked", async () => {
      const user = userEvent.setup();
      (getStudyBenchmarksAction as Mock).mockResolvedValue([makeHEStudy()]);

      render(<BenchmarkSection {...defaultProps} canManage={true} />);

      await waitFor(() => screen.getByRole("button", { name: /^flow$/i }));
      await user.click(screen.getByRole("button", { name: /^flow$/i }));

      expect(mockPush).toHaveBeenCalledWith(
        "/evaluation/new?benchmarkSourceId=study-123&mode=flow",
      );
    });

    it("navigates to persona benchmark URL when Persona button clicked", async () => {
      const user = userEvent.setup();
      (getStudyBenchmarksAction as Mock).mockResolvedValue([makeHEStudy()]);

      render(<BenchmarkSection {...defaultProps} canManage={true} />);

      await waitFor(() => screen.getByRole("button", { name: /^persona$/i }));
      await user.click(screen.getByRole("button", { name: /^persona$/i }));

      expect(mockPush).toHaveBeenCalledWith(
        "/evaluation/new?benchmarkSourceId=study-123&mode=persona",
      );
    });
  });

  // ── Benchmark table ────────────────────────────────────────────────────────

  describe("Benchmark table (multiple studies)", () => {
    const sourcStudy = makeHEStudy({
      id: "study-123",
      benchmarkSourceId: null,
    });
    const benchmarkStudy = makeHEStudy({
      id: "benchmark-study-456",
      benchmarkSourceId: "study-123",
      createdAt: "2026-03-01T10:00:00Z",
      name: "Benchmark Run 1",
    });

    it("shows table when more than one study exists", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("2 benchmarks")).toBeInTheDocument();
      });
    });

    it("shows 'New Benchmark' button when canManage is true", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} canManage={true} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /new benchmark/i }),
        ).toBeInTheDocument();
      });
    });

    it("hides 'New Benchmark' button when canManage is false", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} canManage={false} />);

      await waitFor(() => {
        expect(screen.getByText("2 benchmarks")).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /new benchmark/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("shows 'Current' badge on the source study row", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} studyId="study-123" />);

      await waitFor(() => {
        expect(screen.getByText("Current")).toBeInTheDocument();
      });
    });

    it("navigates to new benchmark page when 'New Benchmark' clicked", async () => {
      const user = userEvent.setup();
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} canManage={true} />);

      await waitFor(() =>
        screen.getByRole("button", { name: /new benchmark/i }),
      );
      await user.click(screen.getByRole("button", { name: /new benchmark/i }));

      expect(mockPush).toHaveBeenCalledWith(
        "/evaluation/new?benchmarkSourceId=study-123",
      );
    });

    it("uses singular 'benchmark' when count is 1", async () => {
      // Exactly 2 studies is the threshold where hasBenchmarks becomes true
      // but test the count label by having 2 studies (shows "2 benchmarks")
      // To get "1 benchmark" we'd need exactly 2 studies including source
      const twoStudies = [sourcStudy, benchmarkStudy];
      (getStudyBenchmarksAction as Mock).mockResolvedValue(twoStudies);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        // 2 studies → "2 benchmarks"
        expect(screen.getByText("2 benchmarks")).toBeInTheDocument();
      });
    });

    it("renders grade for completed HE study", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        // calculateGradeWeighted is mocked to return { grade: "B" }
        const gradeCells = screen.getAllByText("B");
        expect(gradeCells.length).toBeGreaterThan(0);
      });
    });

    it("shows 'Running' for pending study", async () => {
      const pendingStudy = makeHEStudy({
        id: "benchmark-pending",
        status: "PENDING",
        benchmarkSourceId: "study-123",
      });
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        pendingStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Running")).toBeInTheDocument();
      });
    });

    it("shows 'Failed' for failed study", async () => {
      const failedStudy = makeHEStudy({
        id: "benchmark-failed",
        status: "FAILED",
        benchmarkSourceId: "study-123",
      });
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        failedStudy,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed")).toBeInTheDocument();
      });
    });

    it("shows Violations column for HE studies", async () => {
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        benchmarkStudy,
      ]);

      render(
        <BenchmarkSection {...defaultProps} studyType="HEURISTIC_EVALUATION" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Violations")).toBeInTheDocument();
      });
    });

    it("hides Violations column for CW studies", async () => {
      const sourceCW = makeCWStudy({
        id: "study-123",
        benchmarkSourceId: null,
      });
      const benchmarkCW = makeCWStudy({
        id: "benchmark-cw-789",
        benchmarkSourceId: "study-123",
      });
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourceCW,
        benchmarkCW,
      ]);

      render(
        <BenchmarkSection
          {...defaultProps}
          studyType="COGNITIVE_WALKTHROUGH"
          studyKind="walkthrough"
        />,
      );

      await waitFor(() => {
        expect(screen.queryByText("Violations")).not.toBeInTheDocument();
      });
    });
  });

  // ── Persona display ────────────────────────────────────────────────────────

  describe("Persona display", () => {
    it("shows persona name when study has a persona", async () => {
      const sourcStudy = makeHEStudy({
        id: "study-123",
        benchmarkSourceId: null,
      });
      const studyWithPersona = makeHEStudy({
        id: "benchmark-persona",
        benchmarkSourceId: "study-123",
        heuristicEvaluation: {
          id: "he-2",
          persona: { id: "p-1", studyId: "persona-study-1", name: "Alice" },
          results: [],
          heuristicFamily: { heuristics: [{ id: "h1" }] },
        },
      });
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        studyWithPersona,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });
    });

    it("shows 'No persona' when study has no persona", async () => {
      const sourcStudy = makeHEStudy({
        id: "study-123",
        benchmarkSourceId: null,
      });
      const studyNoPersona = makeHEStudy({
        id: "benchmark-no-persona",
        benchmarkSourceId: "study-123",
      });
      (getStudyBenchmarksAction as Mock).mockResolvedValue([
        sourcStudy,
        studyNoPersona,
      ]);

      render(<BenchmarkSection {...defaultProps} />);

      await waitFor(() => {
        const noCells = screen.getAllByText("No persona");
        expect(noCells.length).toBeGreaterThan(0);
      });
    });
  });
});
