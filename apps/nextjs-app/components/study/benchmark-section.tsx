"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/apps/nextjs-app/components/ui/table";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { getStudyBenchmarksAction } from "@/apps/nextjs-app/lib/actions/benchmark-actions";
import {
  calculateGradeWeighted,
  type ScoredIssue,
} from "@/apps/nextjs-app/utils/grade-utils";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { useLocale, useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BenchmarkStudyType =
  | "HEURISTIC_EVALUATION"
  | "COGNITIVE_WALKTHROUGH";

interface BenchmarkRowStudy {
  id: string;
  createdAt: string;
  type: BenchmarkStudyType;
  name: string | null;
  status: "COMPLETED" | "PENDING" | "FAILED";
  benchmarkSourceId: string | null;
  heuristicEvaluation?: {
    id: string;
    persona?: { id: string; studyId: string; name?: string | null } | null;
    results: Array<{ violated: boolean; severity?: number | null }>;
    heuristicFamily?: { heuristics: Array<{ id: string }> } | null;
  } | null;
  cognitiveWalkthrough?: {
    id: string;
    persona?: { id: string; studyId: string; name?: string | null } | null;
    steps: Array<{
      step: number;
      expected: boolean;
      issues: Array<{ severity?: number | null }>;
    }>;
  } | null;
  files: Array<{ id: string }>;
}

interface BenchmarkSectionProps {
  studyId: string;
  studyType: BenchmarkStudyType;
  /** "evaluation" | "walkthrough" — drives the CTA link */
  studyKind: "evaluation" | "walkthrough";
  /** Whether the current user can create a new benchmark */
  canManage: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPersonaName(study: BenchmarkRowStudy, t: any): string {
  const persona =
    study.heuristicEvaluation?.persona ?? study.cognitiveWalkthrough?.persona;
  if (!persona) return t("noPersona");
  return persona.name ?? t("unnamedPersona");
}

function getGrade(study: BenchmarkRowStudy): string {
  if (study.status !== "COMPLETED") return "—";
  if (!study.heuristicEvaluation) return "—";

  const he = study.heuristicEvaluation;
  const totalScreens = study.files.length;
  const totalHeuristics = he.heuristicFamily?.heuristics.length ?? 0;
  const scoredIssues: ScoredIssue[] = he.results.map((r) => ({
    violated: r.violated,
    severity: r.severity,
  }));
  if (totalScreens === 0 || totalHeuristics === 0) return "—";
  const info = calculateGradeWeighted(
    scoredIssues,
    totalScreens,
    totalHeuristics,
  );
  return info.grade;
}

function getUnexpectedStepCount(study: BenchmarkRowStudy): number {
  return (
    study.cognitiveWalkthrough?.steps.filter(
      (s) => s.step > 1 && s.expected === false,
    ).length ?? 0
  );
}

function getGradeColorClass(grade: string): string {
  switch (grade) {
    case "A":
      return "text-green-600";
    case "B":
      return "text-lime-600";
    case "C":
      return "text-yellow-600";
    case "D":
      return "text-orange-600";
    case "F":
      return "text-red-600";
    default:
      return "text-zinc-500";
  }
}

function getIssueCount(study: BenchmarkRowStudy): number {
  if (study.heuristicEvaluation) {
    return study.heuristicEvaluation.results.filter((r) => r.violated).length;
  }
  if (study.cognitiveWalkthrough) {
    return study.cognitiveWalkthrough.steps.reduce(
      (sum, step) => sum + step.issues.length,
      0,
    );
  }
  return 0;
}

function getViolationCount(study: BenchmarkRowStudy): number | null {
  if (study.type !== "HEURISTIC_EVALUATION") return null;
  return (
    study.heuristicEvaluation?.results.filter((r) => r.violated).length ?? 0
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BenchmarkSection({
  studyId,
  studyType,
  studyKind,
  canManage,
}: BenchmarkSectionProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Benchmarks");
  const tShared = useTranslations("SharedStudy");

  const [studies, setStudies] = useState<BenchmarkRowStudy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);

  useEffect(() => {
    getStudyBenchmarksAction(studyId)
      .then((data) => setStudies(data as BenchmarkRowStudy[]))
      .catch(() => setStudies([]))
      .finally(() => setLoading(false));
  }, [studyId]);

  const newBenchmarkHref = `/${studyKind}/new?benchmarkSourceId=${studyId}`;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  // ── Empty state — no benchmarks yet ──
  // The API always includes the current study itself, so > 1 means at least one actual benchmark exists.
  const hasBenchmarks = studies && studies.length > 1;

  const studyKindText = tShared(`typeLabel.${studyKind}`).toLowerCase();

  return (
    <div className="mt-10">
      <h3 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
        {t("title")}
      </h3>

      {!hasBenchmarks ? (
        /* ── Empty state card ── */
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-base">{t("noBenchmarks")}</CardTitle>
            <CardDescription>
              {t("compareDescription", { studyKind: studyKindText })}
            </CardDescription>
          </CardHeader>
          {canManage && (
            <CardContent className="flex justify-center gap-2">
              <Button
                size="sm"
                onClick={() => router.push(`${newBenchmarkHref}&mode=flow`)}
              >
                {t("flow")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`${newBenchmarkHref}&mode=persona`)}
              >
                {t("persona")}
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        /* ── Benchmark table ── */
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-medium">
              {t("benchmarksCount", { count: studies.length })}
            </p>
            {canManage && (
              <Button size="sm" onClick={() => router.push(newBenchmarkHref)}>
                {t("newBenchmark")}
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold">{t("date")}</TableHead>
                <TableHead className="font-bold">{t("name")}</TableHead>
                <TableHead className="font-bold">{t("personaColumn")}</TableHead>
                {studyType === "HEURISTIC_EVALUATION" ? (
                  <>
                    <TableHead className="font-bold">{t("grade")}</TableHead>
                    <TableHead className="text-right font-bold">
                      {t("issues")}
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      {t("violations")}
                    </TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right font-bold">
                      {t("unexpectedSteps")}
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      {t("issues")}
                    </TableHead>
                  </>
                )}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((study) => {
                const grade = getGrade(study);
                const issueCount = getIssueCount(study);
                const violationCount = getViolationCount(study);
                const isCurrentStudy = study.id === studyId;
                const isInteractive =
                  hoveredRow === study.id || focusedRow === study.id;

                return (
                  <TableRow
                    key={study.id}
                    className="group"
                    onMouseEnter={() => setHoveredRow(study.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <TableCell>
                      <span className="text-sm">
                        {formatDate(study.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">
                          {study.name ?? "—"}
                        </span>
                        {isCurrentStudy && (
                          <Badge
                            variant="outline"
                            className="text-xs text-zinc-500"
                          >
                            {t("current")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getPersonaName(study, t)}
                    </TableCell>
                    {studyType === "HEURISTIC_EVALUATION" ? (
                      <>
                        <TableCell>
                          {study.status === "PENDING" ? (
                            <div className="flex items-center gap-1 text-zinc-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span className="text-sm">{t("running")}</span>
                            </div>
                          ) : study.status === "FAILED" ? (
                            <span className="text-sm text-red-500">{t("failed")}</span>
                          ) : (
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                getGradeColorClass(grade),
                              )}
                            >
                              {grade}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {study.status === "COMPLETED" ? issueCount : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {study.status === "COMPLETED"
                             ? (violationCount ?? "—")
                             : "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right text-sm">
                          {study.status === "COMPLETED" ? (
                            getUnexpectedStepCount(study)
                          ) : study.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-1 text-zinc-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>{t("running")}</span>
                            </div>
                          ) : (
                            <span className="text-red-500">{t("failed")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {study.status === "COMPLETED" ? issueCount : "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "transition-opacity",
                          isInteractive
                            ? "opacity-100"
                            : "opacity-0 disabled:opacity-0",
                        )}
                        disabled={isCurrentStudy}
                        aria-label={
                          isCurrentStudy ? t("currentlyViewing") : t("openStudy")
                        }
                        onFocus={() => setFocusedRow(study.id)}
                        onBlur={() => setFocusedRow(null)}
                        onClick={() => {
                          if (!isCurrentStudy) {
                            window.open(`/${studyKind}/${study.id}`, "_blank");
                          }
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">Open</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
