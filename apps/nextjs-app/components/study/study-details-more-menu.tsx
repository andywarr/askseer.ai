"use client";

import { useState } from "react";

// Next imports
import { useRouter } from "next/navigation";

// Lib function imports
import { deleteStudy } from "@/apps/nextjs-app/lib/data";
import { deleteS3Objects } from "@/apps/nextjs-app/lib/action";
import {
  convertHeuristicResultsToCSV,
  downloadCSV,
  downloadExcel,
} from "@/apps/nextjs-app/utils/heuristic-export";
import {
  hasFigmaFiles,
  extractHeuristicEvaluationIssues,
  extractCognitiveWalkthroughIssues,
  type IssueComment,
} from "@/apps/nextjs-app/lib/figma-comments";
import { toast } from "sonner";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import { AddToFigmaDialog } from "@/apps/nextjs-app/components/figma/add-to-figma-dialog";
import { StarStudyButton } from "@/apps/nextjs-app/components/study/star-study-button";
import { ShareStudyDialog } from "@/apps/nextjs-app/components/study/share-study-dialog";
import { Share2, Trash2, Pencil } from "lucide-react";
import {
  handleUpdateStudyVisibility,
  handleRegenerateShareToken,
} from "@/apps/nextjs-app/lib/actions/study-actions";
import type { StudyVisibility } from "@/apps/nextjs-app/types/types";

// Menu configuration types and constants
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";

export enum MenuItem {
  SHARE = "SHARE",
  EXPORT = "EXPORT",
  PRINT = "PRINT",
  EDIT = "EDIT",
  DELETE = "DELETE",
  ADD_TO_FIGMA = "ADD_TO_FIGMA",
  STAR = "STAR",
}

export type MenuItemKey = keyof typeof MenuItem;

// Surface configuration - defines which menu items appear for each surface
const SURFACE_CONFIG: Record<
  MenuSurface.EVALUATION | MenuSurface.WALKTHROUGH | MenuSurface.PERSONA,
  MenuItem[]
> = {
  [MenuSurface.EVALUATION]: [
    MenuItem.STAR,
    MenuItem.SHARE,
    MenuItem.ADD_TO_FIGMA,
    MenuItem.EXPORT,
    MenuItem.PRINT,
    MenuItem.DELETE,
  ],
  [MenuSurface.WALKTHROUGH]: [
    MenuItem.STAR,
    MenuItem.SHARE,
    MenuItem.ADD_TO_FIGMA,
    MenuItem.DELETE,
  ],
  [MenuSurface.PERSONA]: [
    MenuItem.STAR,
    MenuItem.SHARE,
    MenuItem.EDIT,
    MenuItem.DELETE,
  ],
};

interface MoreMenuProps {
  // Optional study context for study surfaces
  study?: any;
  userId?: string;
  surface?: MenuSurface | keyof typeof MenuSurface;
  // Generic callbacks for non-study surfaces (or to override defaults)
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void | Promise<void>;
  // Optional extra S3 keys to remove (e.g., persona cover/photo keys)
  s3Keys?: string[];
  canDelete?: boolean;
  canEdit?: boolean;
  canShare?: boolean;
  // Optional reason why delete is disabled (shown as tooltip)
  deleteDisabledReason?: string;
  // Optional reason why edit is disabled (shown as tooltip)
  editDisabledReason?: string;
  // Optional reason why share is disabled (shown as tooltip)
  shareDisabledReason?: string;
  // Star functionality
  isStarred?: boolean;
  // Team/company context for share dialog
  hasCompany?: boolean;
  isPersonalTeam?: boolean;
}

export default function MoreMenu({
  study,
  userId,
  surface,
  onDelete,
  onEdit,
  s3Keys = [],
  canDelete = true,
  canEdit = true,
  canShare = true,
  deleteDisabledReason,
  editDisabledReason,
  shareDisabledReason,
  isStarred = false,
  hasCompany = false,
  isPersonalTeam = false,
}: MoreMenuProps) {
  const router = useRouter();
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaIssues, setFigmaIssues] = useState<IssueComment[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Get the menu items for the current surface
  const resolvedSurface = surface || MenuSurface.PERSONA;
  const allowedMenuItems = SURFACE_CONFIG[resolvedSurface];

  // Check if study has Figma files
  const studyHasFigmaFiles = study?.files && hasFigmaFiles(study.files);

  // Note: We don't filter out DELETE or EDIT when disabled - instead, we show them
  // as disabled with a tooltip explaining why. See renderDeleteMenuItem() and renderEditMenuItem().

  const handleDelete = async () => {
    if (!canDelete) return;
    if (typeof onDelete === "function") {
      await onDelete();
      return;
    }

    // Fallback to study delete when study context is available
    if (!study || !userId) return;
    try {
      // Delete the study from the database
      await deleteStudy(study.id, userId);

      // Collect S3 keys to delete: study files + any extra provided keys (e.g., persona images)
      const studyFileKeys: string[] = Array.isArray(study?.files)
        ? study.files.map((file: { key?: string }) => file?.key).filter(Boolean)
        : [];
      const extraKeys: string[] = Array.isArray(s3Keys)
        ? s3Keys.filter(Boolean)
        : [];

      const keysToDelete = [...studyFileKeys, ...extraKeys];

      if (keysToDelete.length > 0) {
        // Delete associated objects from S3
        await deleteS3Objects(keysToDelete as string[]);
      }

      // Redirect to the studies page
      router.push("/studies");
    } catch (error) {
      console.error("Failed to delete study or S3 objects:", error);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      // Check if heuristic evaluation results exist
      if (
        !study?.heuristicEvaluation?.results ||
        study.heuristicEvaluation.results.length === 0
      ) {
        toast.error(
          "No heuristic evaluation results available to export. Please ensure your study has completed evaluation results.",
        );
        return;
      }

      // Group the heuristic evaluation results by heuristic ID (similar to page.tsx)
      const groupedResultsByHeuristic =
        study.heuristicEvaluation.results.reduce(
          (acc: { [key: string]: any[] }, result: any) => {
            if (!acc[result.heuristicId]) {
              acc[result.heuristicId] = [];
            }
            acc[result.heuristicId].push(result);
            return acc;
          },
          {},
        );

      // Convert to CSV format
      const csvData = convertHeuristicResultsToCSV(
        groupedResultsByHeuristic,
        study.name || "Untitled Study",
        study.files || [],
      );

      if (csvData.length === 0) {
        toast.error(
          "No data could be converted for export. Please check your study results.",
        );
        return;
      }

      // Generate filename with timestamp (local time)
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
      const sanitizedStudyName = (study.name || "heuristic-evaluation").replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );
      const heuristicFamilyName =
        study.heuristicEvaluation.heuristicFamily?.name || "Unknown";
      const sanitizedHeuristicType = heuristicFamilyName.replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );
      const filename = `${sanitizedStudyName}-${sanitizedHeuristicType}-${timestamp}.csv`;

      // Download the CSV file
      downloadCSV(csvData, filename);
    } catch (error) {
      console.error("Failed to download CSV:", error);
      toast.error(
        "Failed to download CSV file. Please try again or contact support.",
      );
    }
  };

  const handleDownloadExcel = async () => {
    try {
      // Check if heuristic evaluation results exist
      if (
        !study?.heuristicEvaluation?.results ||
        study.heuristicEvaluation.results.length === 0
      ) {
        toast.error(
          "No heuristic evaluation results available to export. Please ensure your study has completed evaluation results.",
        );
        return;
      }

      // Group the heuristic evaluation results by heuristic ID (similar to page.tsx)
      const groupedResultsByHeuristic =
        study.heuristicEvaluation.results.reduce(
          (acc: { [key: string]: any[] }, result: any) => {
            if (!acc[result.heuristicId]) {
              acc[result.heuristicId] = [];
            }
            acc[result.heuristicId].push(result);
            return acc;
          },
          {},
        );

      // Convert to CSV format (same data structure as CSV)
      const csvData = convertHeuristicResultsToCSV(
        groupedResultsByHeuristic,
        study.name || "Untitled Study",
        study.files || [],
      );

      if (csvData.length === 0) {
        toast.error(
          "No data could be converted for export. Please check your study results.",
        );
        return;
      }

      // Generate filename with timestamp (local time)
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
      const sanitizedStudyName = (study.name || "heuristic-evaluation").replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );
      const heuristicFamilyName =
        study.heuristicEvaluation.heuristicFamily?.name || "Unknown";
      const sanitizedHeuristicType = heuristicFamilyName.replace(
        /[^a-zA-Z0-9-_]/g,
        "-",
      );
      const filename = `${sanitizedStudyName}-${sanitizedHeuristicType}-${timestamp}.xlsx`;

      // Download the Excel file
      downloadExcel(csvData, filename);
    } catch (error) {
      console.error("Failed to download Excel:", error);
      toast.error(
        "Failed to download Excel file. Please try again or contact support.",
      );
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleAddToFigma = () => {
    if (!study || !studyHasFigmaFiles) {
      toast.error("No Figma files found in this study");
      return;
    }

    let issues: IssueComment[] = [];

    // Extract issues based on study type
    if (
      resolvedSurface === MenuSurface.EVALUATION &&
      study.heuristicEvaluation?.results
    ) {
      issues = extractHeuristicEvaluationIssues(
        study.heuristicEvaluation.results,
        study.files || [],
      );
    } else if (
      resolvedSurface === MenuSurface.WALKTHROUGH &&
      study.cognitiveWalkthrough?.steps
    ) {
      issues = extractCognitiveWalkthroughIssues(
        study.cognitiveWalkthrough.steps,
        study.files || [],
      );
    }

    if (issues.length === 0) {
      toast.info("No issues to add as Figma comments", {
        description:
          "Only issues from files imported from Figma can be added as comments.",
      });
      return;
    }

    setFigmaIssues(issues);
    setFigmaDialogOpen(true);
  };

  const renderStarMenuItem = () => {
    if (!study || !userId) return null;
    return (
      <StarStudyButton
        key="star"
        studyId={study.id}
        userId={userId}
        isStarred={isStarred}
        variant="menuItem"
      />
    );
  };

  const renderShareMenuItem = () => {
    if (!study) return null;

    // If user can't share, show disabled menu item with tooltip
    if (!canShare) {
      const menuItem = (
        <DropdownMenuItem key="share" disabled={true}>
          <Share2 className="mr-2 h-4 w-4 text-zinc-400" />
          <span className="text-zinc-400">Share</span>
        </DropdownMenuItem>
      );

      if (shareDisabledReason) {
        return (
          <Tooltip key="share">
            <TooltipTrigger asChild>
              <span className="w-full">{menuItem}</span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{shareDisabledReason}</p>
            </TooltipContent>
          </Tooltip>
        );
      }

      return menuItem;
    }

    return (
      <DropdownMenuItem
        key="share"
        onSelect={(e) => {
          e.preventDefault();
          setShareDialogOpen(true);
        }}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </DropdownMenuItem>
    );
  };

  const handleShareVisibilityChange = async (
    newVisibility: StudyVisibility,
  ): Promise<{ success: boolean; shareToken?: string }> => {
    if (!study) return { success: false };
    const result = await handleUpdateStudyVisibility(study.id, newVisibility);
    if (result.success) {
      return { success: true, shareToken: result.shareToken ?? undefined };
    }
    return { success: false };
  };

  const handleShareRegenerateToken = async (): Promise<{
    success: boolean;
    shareToken?: string;
  }> => {
    if (!study) return { success: false };
    const result = await handleRegenerateShareToken(study.id);
    if (result.success && result.shareToken) {
      return { success: true, shareToken: result.shareToken };
    }
    return { success: false };
  };

  const handleShareDialogOpenChange = (open: boolean) => {
    setShareDialogOpen(open);
    if (!open) {
      // Use setTimeout to ensure the dialog fully closes before closing the dropdown
      setTimeout(() => {
        setDropdownOpen(false);
        setTooltipOpen(false);
      }, 0);
    }
  };

  const renderAddToFigmaMenuItem = () => {
    // Temporarily disabled due to Figma API rate limiting
    const menuItem = (
      <DropdownMenuItem key="add-to-figma" disabled={true}>
        <span className="text-zinc-400">Add to Figma</span>
      </DropdownMenuItem>
    );

    return (
      <Tooltip key="add-to-figma">
        <TooltipTrigger asChild>
          <span className="w-full">{menuItem}</span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Coming back soon</p>
        </TooltipContent>
      </Tooltip>
    );

    // TODO: Re-enable when Figma API rate limiting is resolved
    // const isDisabled = !studyHasFigmaFiles;
    //
    // const menuItem = (
    //   <DropdownMenuItem
    //     key="add-to-figma"
    //     onClick={handleAddToFigma}
    //     disabled={isDisabled}
    //   >
    //     <span className={isDisabled ? "text-zinc-400" : undefined}>
    //       Add to Figma
    //     </span>
    //   </DropdownMenuItem>
    // );
    //
    // if (isDisabled) {
    //   return (
    //     <Tooltip key="add-to-figma">
    //       <TooltipTrigger asChild>
    //         <span className="w-full">{menuItem}</span>
    //       </TooltipTrigger>
    //       <TooltipContent side="left">
    //         <p>Only available for studies with Figma-imported files</p>
    //       </TooltipContent>
    //     </Tooltip>
    //   );
    // }
    //
    // return menuItem;
  };

  const renderExportMenuItem = () => (
    <DropdownMenuSub key="export">
      <DropdownMenuSubTrigger>
        <span>Export</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={handleDownloadCSV}>
          <span>CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadExcel}>
          <span>Excel</span>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );

  const renderPrintMenuItem = () => (
    <DropdownMenuItem key="print" onClick={handlePrint}>
      <span>Print</span>
    </DropdownMenuItem>
  );

  const renderDeleteMenuItem = () => {
    const canDeleteStudy =
      canDelete && (typeof onDelete === "function" || (!!study && !!userId));

    const menuItem = (
      <DropdownMenuItem
        onClick={async () => {
          if (!canDeleteStudy) return;
          await handleDelete();
          toast.success("Successfully deleted study");
        }}
        key="delete"
        disabled={!canDeleteStudy}
      >
        <Trash2
          className={`mr-2 h-4 w-4 ${canDeleteStudy ? "text-red-500" : "text-zinc-500"}`}
        />
        <span className={canDeleteStudy ? "text-red-500" : "text-zinc-500"}>
          Delete
        </span>
      </DropdownMenuItem>
    );

    // Show tooltip explaining why delete is disabled
    // Wrap in a span to allow pointer events on disabled elements
    if (!canDeleteStudy && deleteDisabledReason) {
      return (
        <Tooltip key="delete">
          <TooltipTrigger asChild>
            <span className="w-full">{menuItem}</span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{deleteDisabledReason}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return menuItem;
  };

  const renderEditMenuItem = () => {
    const menuItem = (
      <DropdownMenuItem
        onClick={async () => {
          if (!canEdit) return;
          if (typeof onEdit === "function") {
            await onEdit();
          }
        }}
        key="edit"
        disabled={!canEdit}
      >
        <Pencil className={`mr-2 h-4 w-4 ${canEdit ? "" : "text-zinc-400"}`} />
        <span className={canEdit ? undefined : "text-zinc-400"}>Edit</span>
      </DropdownMenuItem>
    );

    // Show tooltip explaining why edit is disabled
    // Wrap in a span to allow pointer events on disabled elements
    if (!canEdit && editDisabledReason) {
      return (
        <Tooltip key="edit">
          <TooltipTrigger asChild>
            <span className="w-full">{menuItem}</span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{editDisabledReason}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return menuItem;
  };

  // Map menu items to their render functions
  const menuItemRenderers: Record<MenuItem, () => React.ReactNode> = {
    [MenuItem.STAR]: renderStarMenuItem,
    [MenuItem.SHARE]: renderShareMenuItem,
    [MenuItem.EXPORT]: renderExportMenuItem,
    [MenuItem.PRINT]: renderPrintMenuItem,
    [MenuItem.EDIT]: renderEditMenuItem,
    [MenuItem.DELETE]: renderDeleteMenuItem,
    [MenuItem.ADD_TO_FIGMA]: renderAddToFigmaMenuItem,
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        open={dropdownOpen}
        onOpenChange={(open) => {
          setDropdownOpen(open);
          if (open) setTooltipOpen(false);
        }}
      >
        <Tooltip open={tooltipOpen && !dropdownOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="h-4"
                  viewBox="0 -960 960 960"
                  width="h-4"
                  fill="currentColor"
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>More</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuGroup>
            {allowedMenuItems.map((menuItem) => menuItemRenderers[menuItem]())}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {study && userId && (
        <AddToFigmaDialog
          open={figmaDialogOpen}
          onOpenChange={setFigmaDialogOpen}
          issues={figmaIssues}
          isCognitiveWalkthrough={resolvedSurface === MenuSurface.WALKTHROUGH}
        />
      )}

      {study && (
        <ShareStudyDialog
          studyId={study.id}
          userId={userId || ""}
          currentVisibility={study.visibility || "TEAM"}
          shareToken={study.shareToken}
          hasCompany={hasCompany}
          isPersonalTeam={isPersonalTeam}
          onVisibilityChange={handleShareVisibilityChange}
          onRegenerateToken={handleShareRegenerateToken}
          open={shareDialogOpen}
          onOpenChange={handleShareDialogOpenChange}
        />
      )}
    </>
  );
}
