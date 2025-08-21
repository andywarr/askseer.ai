"use client";

// Next imports
import { useRouter } from "next/navigation";

// Lib function imports
import { deleteStudy } from "@/apps/nextjs-app/lib/data";
import {
  deleteS3Objects,
  convertFromHeuristicType,
} from "@/apps/nextjs-app/lib/action";
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
export enum MenuSurface {
  EVALUATION = "EVALUATION",
  WALKTHROUGH = "WALKTHROUGH",
  PERSONA = "PERSONA",
}

export enum MenuItem {
  SHARE = "SHARE",
  EXPORT = "EXPORT",
  DELETE = "DELETE",
}

// Surface configuration - defines which menu items appear for each surface
const SURFACE_CONFIG: Record<
  "EVALUATION" | "WALKTHROUGH" | "PERSONA",
  MenuItem[]
> = {
  [MenuSurface.EVALUATION]: [MenuItem.SHARE, MenuItem.EXPORT, MenuItem.DELETE],
  [MenuSurface.WALKTHROUGH]: [MenuItem.SHARE, MenuItem.DELETE],
  [MenuSurface.PERSONA]: [MenuItem.SHARE, MenuItem.DELETE],
};

interface MoreMenuProps {
  // Optional study context for study surfaces
  study?: any;
  userId?: string;
  surface?: MenuSurface | keyof typeof MenuSurface;
  // Generic callbacks for non-study surfaces (or to override defaults)
  onShare?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

export default function MoreMenu({
  study,
  userId,
  surface = MenuSurface.EVALUATION, // Default to evaluation surface
  onShare,
  onDelete,
}: MoreMenuProps) {
  const router = useRouter();
  const normalizedSurface: "EVALUATION" | "WALKTHROUGH" | "PERSONA" =
    typeof surface === "string" ? (surface as any) : surface;
  const isPersona = normalizedSurface === "PERSONA";

  // Get the menu items for the current surface
  const allowedMenuItems = SURFACE_CONFIG[normalizedSurface];

  const handleDelete = async () => {
    if (typeof onDelete === "function") {
      await onDelete();
      return;
    }

    // Fallback to study delete when study context is available
    if (!study || !userId) return;
    try {
      // Delete the heuristic evaluation from the database
      await deleteStudy(study.id, userId);

      // Delete the images from S3
      await deleteS3Objects(
        study.files.map((file: { key: string }) => file.key),
      );

      // Redirect to the heuristic evaluations page
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
      const heuristicType = await convertFromHeuristicType(
        study.heuristicEvaluation.type,
      );
      const sanitizedHeuristicType = heuristicType.replace(
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
      const heuristicType = await convertFromHeuristicType(
        study.heuristicEvaluation.type,
      );
      const sanitizedHeuristicType = heuristicType.replace(
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

  // Helper function to render individual menu items
  const handleShare = async () => {
    if (typeof onShare === "function") {
      await onShare();
      return;
    }
    if (isPersona && typeof window !== "undefined" && navigator?.clipboard) {
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

  const renderDeleteMenuItem = () => {
    const canDelete = typeof onDelete === "function" || (!!study && !!userId);
    return (
      <DropdownMenuItem
        onClick={handleDelete}
        key="delete"
        disabled={!canDelete}
      >
        <span className="text-red-500">Delete</span>
      </DropdownMenuItem>
    );
  };

  // Map menu items to their render functions
  const menuItemRenderers: Record<MenuItem, () => React.ReactNode> = {
    [MenuItem.SHARE]: renderShareMenuItem,
    [MenuItem.EXPORT]: renderExportMenuItem,
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
