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
import { AddToFigmaDialog } from "@/apps/nextjs-app/components/add-to-figma-dialog";

// Menu configuration types and constants
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";

export enum MenuItem {
  SHARE = "SHARE",
  EXPORT = "EXPORT",
  PRINT = "PRINT",
  EDIT = "EDIT",
  DELETE = "DELETE",
  ADD_TO_FIGMA = "ADD_TO_FIGMA",
}

export type MenuItemKey = keyof typeof MenuItem;

// Surface configuration - defines which menu items appear for each surface
const SURFACE_CONFIG: Record<
  MenuSurface.EVALUATION | MenuSurface.WALKTHROUGH | MenuSurface.PERSONA,
  MenuItem[]
> = {
  [MenuSurface.EVALUATION]: [
    MenuItem.ADD_TO_FIGMA,
    MenuItem.EXPORT,
    MenuItem.PRINT,
    MenuItem.DELETE,
  ],
  [MenuSurface.WALKTHROUGH]: [MenuItem.ADD_TO_FIGMA, MenuItem.DELETE],
  [MenuSurface.PERSONA]: [MenuItem.EDIT, MenuItem.DELETE],
};

interface MoreMenuProps {
  // Optional study context for study surfaces
  study?: any;
  userId?: string;
  surface?: MenuSurface | keyof typeof MenuSurface;
  // Generic callbacks for non-study surfaces (or to override defaults)
  onShare?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void | Promise<void>;
  // Optional extra S3 keys to remove (e.g., persona cover/photo keys)
  s3Keys?: string[];
  canDelete?: boolean;
  canEdit?: boolean;
  // Optional reason why delete is disabled (shown as tooltip)
  deleteDisabledReason?: string;
  // Optional reason why edit is disabled (shown as tooltip)
  editDisabledReason?: string;
}

export default function MoreMenu({
  study,
  userId,
  surface,
  onShare,
  onDelete,
  onEdit,
  s3Keys = [],
  canDelete = true,
  canEdit = true,
  deleteDisabledReason,
  editDisabledReason,
}: MoreMenuProps) {
  const router = useRouter();
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaIssues, setFigmaIssues] = useState<IssueComment[]>([]);

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

  // Helper function to render individual menu items
  const handleShare = async () => {
    if (typeof onShare === "function") {
      await onShare();
      return;
    }
    if (typeof window !== "undefined" && navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
      } catch (e) {
        toast.error("Failed to copy link");
      }
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

  const renderShareMenuItem = () => {
    return (
      <DropdownMenuItem key="share" disabled={true} onClick={handleShare}>
        <span>Share</span>
      </DropdownMenuItem>
    );
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
    [MenuItem.SHARE]: renderShareMenuItem,
    [MenuItem.EXPORT]: renderExportMenuItem,
    [MenuItem.PRINT]: renderPrintMenuItem,
    [MenuItem.EDIT]: renderEditMenuItem,
    [MenuItem.DELETE]: renderDeleteMenuItem,
    [MenuItem.ADD_TO_FIGMA]: renderAddToFigmaMenuItem,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="h-4"
              viewBox="0 -960 960 960"
              width="h-4"
              fill="currentColor"
            >
              <path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
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
    </>
  );
}
