"use client";

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

// Menu configuration types and constants
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";

export enum MenuItem {
  SHARE = "SHARE",
  EXPORT = "EXPORT",
  PRINT = "PRINT",
  EDIT = "EDIT",
  DELETE = "DELETE",
}

export type MenuItemKey = keyof typeof MenuItem;

// Surface configuration - defines which menu items appear for each surface
const SURFACE_CONFIG: Record<
  MenuSurface.EVALUATION | MenuSurface.WALKTHROUGH | MenuSurface.PERSONA,
  MenuItem[]
> = {
  [MenuSurface.EVALUATION]: [
    MenuItem.SHARE,
    MenuItem.EXPORT,
    MenuItem.PRINT,
    MenuItem.DELETE,
  ],
  [MenuSurface.WALKTHROUGH]: [MenuItem.SHARE, MenuItem.DELETE],
  [MenuSurface.PERSONA]: [MenuItem.SHARE, MenuItem.EDIT, MenuItem.DELETE],
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
}: MoreMenuProps) {
  const router = useRouter();

  // Get the menu items for the current surface
  const resolvedSurface = surface || MenuSurface.PERSONA;
  let allowedMenuItems = SURFACE_CONFIG[resolvedSurface];

  if (!canDelete) {
    allowedMenuItems = allowedMenuItems.filter(
      (item) => item !== MenuItem.DELETE,
    );
  }

  if (!canEdit) {
    allowedMenuItems = allowedMenuItems.filter(
      (item) => item !== MenuItem.EDIT,
    );
  }

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

  const renderShareMenuItem = () => {
    return (
      <DropdownMenuItem key="share" disabled={true} onClick={handleShare}>
        <span>Share</span>
      </DropdownMenuItem>
    );
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
    return (
      <DropdownMenuItem
        onClick={async () => {
          await handleDelete();
          toast.success("Successfully deleted study");
        }}
        key="delete"
        disabled={!canDeleteStudy}
      >
        <span className="text-red-500">Delete</span>
      </DropdownMenuItem>
    );
  };

  const renderEditMenuItem = () => {
    return (
      <DropdownMenuItem
        onClick={async () => {
          if (typeof onEdit === "function") {
            await onEdit();
          }
        }}
        key="edit"
        disabled={!canEdit}
      >
        <span>Edit</span>
      </DropdownMenuItem>
    );
  };

  // Map menu items to their render functions
  const menuItemRenderers: Record<MenuItem, () => React.ReactNode> = {
    [MenuItem.SHARE]: renderShareMenuItem,
    [MenuItem.EXPORT]: renderExportMenuItem,
    [MenuItem.PRINT]: renderPrintMenuItem,
    [MenuItem.EDIT]: renderEditMenuItem,
    [MenuItem.DELETE]: renderDeleteMenuItem,
  };

  return (
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
  );
}
