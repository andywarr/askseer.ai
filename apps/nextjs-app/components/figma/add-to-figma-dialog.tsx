"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, AlertCircle, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Checkbox } from "@/apps/nextjs-app/components/ui/checkbox";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { Alert, AlertDescription } from "@/apps/nextjs-app/components/ui/alert";

import {
  type IssueComment,
  type CommentOptions,
  getUniqueFigmaFileKeys,
  formatIssueAsComment,
} from "@/apps/nextjs-app/lib/figma-comments";
import { postFigmaComment } from "@/apps/nextjs-app/lib/figma-actions";
import { Progress } from "@/apps/nextjs-app/components/ui/progress";
import { formatRetryTime } from "@/apps/nextjs-app/lib/figma-utils";

interface AddToFigmaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: IssueComment[];
  /** If true, shows "Type" option instead of "Heuristic" (for cognitive walkthroughs) */
  isCognitiveWalkthrough?: boolean;
}

function formatSeverityText(severity: number | null | undefined): string {
  if (severity === null || severity === undefined) return "";
  switch (severity) {
    case 0:
      return "Not a problem";
    case 1:
      return "Cosmetic";
    case 2:
      return "Minor";
    case 3:
      return "Major";
    case 4:
      return "Catastrophic";
    default:
      return `${severity}`;
  }
}

/**
 * Convert issue type to sentence case
 */
function formatIssueType(issueType: string): string {
  // Handle uppercase enum values like DISCOVERABILITY, LEARNABILITY, USABILITY
  if (issueType === issueType.toUpperCase()) {
    return issueType.charAt(0) + issueType.slice(1).toLowerCase();
  }
  return issueType;
}

export function formatIssueWithOptions(
  issue: IssueComment,
  options: CommentOptions,
): string {
  const lines: string[] = [];

  // Header with issue type (heuristic for heuristic evaluation, type for cognitive walkthrough)
  if (options.includeHeuristic) {
    lines.push(`🔍 ${issue.issueType}`);
  } else if (options.includeType) {
    lines.push(`🔍 ${formatIssueType(issue.issueType)}`);
  }

  // Add severity on its own line if present
  if (options.includeSeverity) {
    const severityText = formatSeverityText(issue.severity);
    if (severityText) {
      if (lines.length > 0) lines.push("");
      lines.push(`Severity: ${severityText}`);
    }
  }

  // Issue description
  if (options.includeIssue) {
    if (lines.length > 0) lines.push("");
    lines.push(issue.issue);
  }

  // Recommendations
  if (options.includeRecommendations && issue.recommendations.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("💡 Recommendations:");
    issue.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }

  return lines.join("\n");
}

export function AddToFigmaDialog({
  open,
  onOpenChange,
  issues,
  isCognitiveWalkthrough = false,
}: AddToFigmaDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [options, setOptions] = useState<CommentOptions>({
    includeHeuristic: !isCognitiveWalkthrough,
    includeType: isCognitiveWalkthrough,
    includeIssue: true,
    includeSeverity: true,
    includeRecommendations: true,
  });

  // Track which issues are selected - all selected by default
  const [selectedIssueIndices, setSelectedIssueIndices] = useState<Set<number>>(
    () => new Set(issues.map((_, index) => index)),
  );

  // Rate limit handling state
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitTimeRemaining, setWaitTimeRemaining] = useState(0);
  const [showExcessiveWaitWarning, setShowExcessiveWaitWarning] = useState(false);
  const cancelRef = useRef(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      cancelRef.current = false;
      setIsWaiting(false);
      setWaitTimeRemaining(0);
      setShowExcessiveWaitWarning(false);
    }
  }, [open]);

  // Reset selections when issues change
  useEffect(() => {
    setSelectedIssueIndices(new Set(issues.map((_, index) => index)));
  }, [issues]);

  const figmaFileKeys = getUniqueFigmaFileKeys(
    issues.map((i) => ({ figmaFileKey: i.fileKey })),
  );

  const hasAtLeastOneOption = useMemo(() => {
    return (
      options.includeHeuristic ||
      options.includeType ||
      options.includeIssue ||
      options.includeSeverity ||
      options.includeRecommendations
    );
  }, [options]);

  const toggleIssue = (index: number) => {
    setSelectedIssueIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIssueIndices(new Set(issues.map((_, index) => index)));
  };

  const deselectAll = () => {
    setSelectedIssueIndices(new Set());
  };

  const selectedIssues = issues.filter((_, index) =>
    selectedIssueIndices.has(index),
  );

  const handleOptionChange = (key: keyof CommentOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAddComments = async () => {
    if (!hasAtLeastOneOption) {
      toast.error("Please select at least one option to include in comments");
      return;
    }

    if (selectedIssues.length === 0) {
      toast.error("Please select at least one issue to add as a comment");
      return;
    }

    // Reset cancel flag and state
    cancelRef.current = false;
    setIsLoading(true);
    setProgress({ current: 0, total: selectedIssues.length });
    setShowExcessiveWaitWarning(false);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Rate limit: 10 requests per minute = 7 seconds between requests (with buffer)
    const DELAY_MS = 7000;

    for (let i = 0; i < selectedIssues.length; i++) {
      // Check for cancellation
      if (cancelRef.current) {
        toast.info(`Cancelled after adding ${successCount} comments`);
        break;
      }

      const issue = selectedIssues[i];
      setProgress({ current: i + 1, total: selectedIssues.length });

      const message = formatIssueAsComment(issue, options);
      const result = await postFigmaComment(issue.fileKey, issue.nodeId, message);

      if (result.success) {
        successCount++;
      } else {
        // Check if this is a rate limit error with retry info
        if (result.rateLimitInfo) {
          const { retryAfterSeconds, isExcessiveWait } = result.rateLimitInfo;

          // Show warning for excessive wait times (suggests Starter plan)
          if (isExcessiveWait) {
            setShowExcessiveWaitWarning(true);
          }

          // Wait the appropriate time with countdown
          setIsWaiting(true);
          setWaitTimeRemaining(retryAfterSeconds);

          // Countdown loop
          for (let remaining = retryAfterSeconds; remaining > 0; remaining--) {
            if (cancelRef.current) break;
            setWaitTimeRemaining(remaining);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          setIsWaiting(false);
          setWaitTimeRemaining(0);

          // If cancelled during wait, break out
          if (cancelRef.current) {
            toast.info(`Cancelled after adding ${successCount} comments`);
            break;
          }

          // Retry this issue after waiting
          i--;
          continue;
        }

        // Non-rate-limit error
        errorCount++;
        if (result.error) {
          errors.push(result.error);
        }
      }

      // Wait between requests to avoid rate limiting (except for the last one)
      if (i < selectedIssues.length - 1 && !cancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    setIsLoading(false);
    setIsWaiting(false);
    setProgress({ current: 0, total: 0 });
    setWaitTimeRemaining(0);

    // Don't show success/error if cancelled
    if (cancelRef.current) {
      return;
    }

    if (successCount === selectedIssues.length) {
      toast.success(`Added ${successCount} comments to Figma`, {
        description: "Comments have been posted to the Figma file.",
      });
      onOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(`Added ${successCount} comments, ${errorCount} failed`, {
        description: "Some comments could not be posted to Figma.",
      });
      onOpenChange(false);
    } else {
      toast.error("Failed to add comments to Figma", {
        description: errors[0] || "An unknown error occurred.",
      });
    }
  };

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    if (!isWaiting) {
      // If not currently waiting, close dialog immediately
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
    // If waiting, the countdown loop will detect cancelRef and break
  }, [isWaiting]);

  if (issues.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Add Comments to Figma
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-zinc-400" />
            <p className="text-sm text-zinc-600">
              No issues with Figma metadata found.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Only issues from files imported from Figma can be added as
              comments.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[calc(100vw-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            Add Comments to Figma
          </DialogTitle>
          <DialogDescription>
            Select issues to add as comments to your Figma file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-1 flex-col space-y-4 overflow-hidden">
          {/* Options section */}
          <div className="flex-shrink-0 space-y-3">
            <p className="text-sm font-medium">Include in comments:</p>
            <div className="flex flex-wrap gap-4">
              {isCognitiveWalkthrough ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeType"
                    checked={options.includeType}
                    onCheckedChange={() => handleOptionChange("includeType")}
                  />
                  <Label htmlFor="includeType" className="text-sm">
                    Type
                  </Label>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeHeuristic"
                    checked={options.includeHeuristic}
                    onCheckedChange={() =>
                      handleOptionChange("includeHeuristic")
                    }
                  />
                  <Label htmlFor="includeHeuristic" className="text-sm">
                    Heuristic
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeSeverity"
                  checked={options.includeSeverity}
                  onCheckedChange={() => handleOptionChange("includeSeverity")}
                />
                <Label htmlFor="includeSeverity" className="text-sm">
                  Severity
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeIssue"
                  checked={options.includeIssue}
                  onCheckedChange={() => handleOptionChange("includeIssue")}
                />
                <Label htmlFor="includeIssue" className="text-sm">
                  Issue
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRecommendations"
                  checked={options.includeRecommendations}
                  onCheckedChange={() =>
                    handleOptionChange("includeRecommendations")
                  }
                />
                <Label htmlFor="includeRecommendations" className="text-sm">
                  Recommendations
                </Label>
              </div>
            </div>
            {!hasAtLeastOneOption && (
              <p className="text-xs text-red-500">
                At least one option must be selected
              </p>
            )}
          </div>

          <Separator className="my-2" />

          {/* Selection controls */}
          <div className="flex flex-shrink-0 items-center justify-between">
            <p className="text-sm text-zinc-500">
              {selectedIssues.length} of {issues.length} issue
              {issues.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={selectedIssueIndices.size === issues.length}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={selectedIssueIndices.size === 0}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Comment previews with selection */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto rounded-md border">
              <div className="divide-y">
                {issues.map((issue, index) => {
                  const isSelected = selectedIssueIndices.has(index);
                  const fullComment = formatIssueWithOptions(issue, options);
                  const lines = fullComment.split("\n");
                  const snippetLines = lines.slice(0, 3);
                  const snippet = snippetLines.join("\n");
                  const remainingLines = lines.slice(3).join("\n");
                  const hasMore = lines.length > 3;

                  return (
                    <div
                      key={index}
                      className={`cursor-pointer p-3 transition-colors ${
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                      onClick={() => toggleIssue(index)}
                    >
                      <div className="flex gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleIssue(index)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          {fullComment ? (
                            hasMore ? (
                              <details className="group">
                                <summary className="cursor-pointer list-none">
                                  <pre className="overflow-x-auto text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                    {snippet}
                                    <span className="text-zinc-400 group-open:hidden">
                                      ...
                                    </span>
                                  </pre>
                                  <span className="text-primary mt-1 inline-block text-xs group-open:hidden hover:underline">
                                    Show more
                                  </span>
                                </summary>
                                <pre className="overflow-x-auto text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                  {remainingLines}
                                </pre>
                                <span
                                  className="text-primary mt-1 inline-block cursor-pointer text-xs hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const details =
                                      e.currentTarget.closest("details");
                                    if (details) details.open = false;
                                  }}
                                >
                                  Show less
                                </span>
                              </details>
                            ) : (
                              <pre className="overflow-x-auto text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                                {fullComment}
                              </pre>
                            )
                          ) : (
                            <span className="text-sm text-zinc-400 italic">
                              No content selected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Progress section */}
        {isLoading && progress.total > 0 && (
          <div className="flex-shrink-0 space-y-2 border-t pt-4">
            {/* Rate limit warning for excessive wait times (Starter plan) */}
            {showExcessiveWaitWarning && (
              <Alert className="border-amber-200 bg-amber-50 [&>svg]:static [&>svg+div]:translate-y-0 [&>svg~*]:pl-0">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Figma API rate limit reached.</strong> This typically
                  happens with Figma plans that have lower API
                  rate limits. Consider upgrading your Figma plan for
                  higher rate limits.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Adding comments to Figma...
              </span>
              <span className="text-zinc-500">
                {progress.current} of {progress.total}
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} />
              <p className="text-xs text-zinc-500">
                Approximately{" "}
                {Math.ceil(((progress.total - progress.current) * 7) / 60)}{" "}
                minute
                {Math.ceil(((progress.total - progress.current) * 7) / 60) !== 1
                  ? "s"
                  : ""}{" "}
                remaining.
              </p>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
              Please keep this dialog open until the process completes.
            </p>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={isLoading ? handleCancel : () => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddComments}
            disabled={
              isLoading || !hasAtLeastOneOption || selectedIssues.length === 0
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding {progress.current}/{progress.total}...
              </>
            ) : (
              <>
                Add Comment
                {selectedIssues.length === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
