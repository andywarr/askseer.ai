import { HEResultData } from "@/apps/nextjs-app/types/types";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface CSVRow {
  heuristicId: string;
  heuristicCategory?: string;
  heuristicLabel?: string;
  heuristicName: string;
  step: number | string;
  issueId: string;
  reason: string;
  reasonSource: string;
  recommendationId: string;
  recommendation: string;
  recommendationSource: string;
}

export function convertHeuristicResultsToCSV(
  groupedResults: { [key: string]: HEResultData[] },
  studyName: string,
  files: any[],
): CSVRow[] {
  const csvData: CSVRow[] = [];

  // Validate input data
  if (!groupedResults || typeof groupedResults !== "object") {
    console.warn("Invalid groupedResults data provided");
    return csvData;
  }

  let heuristicCounter = 1;
  let issueCounter = 1;
  let recommendationCounter = 1;

  Object.entries(groupedResults).forEach(([heuristicId, results]) => {
    if (!Array.isArray(results)) {
      console.warn(`Invalid results array for heuristic ${heuristicId}`);
      return;
    }

    results.forEach((result) => {
      if (result.violated === "NO") {
        // Skip results that are not violated
        return;
      }
      // Common row data for this issue
      const baseRowData = {
        heuristicId: `H-${heuristicCounter}`,
        heuristicCategory: result.heuristic?.category || undefined,
        heuristicLabel: result.heuristic?.label || undefined,
        heuristicName: result.heuristic?.heuristic || "Unknown Heuristic",
        step: result.step || "N/A",
        issueId: `I-${issueCounter}`,
        reason: result.reason || "No reason provided",
        reasonSource: result.source || "Unknown",
      };

      issueCounter++;

      // Then, create one row for each recommendation
      if (result.recommendations && result.recommendations.length > 0) {
        result.recommendations.forEach((rec) => {
          csvData.push({
            ...baseRowData,
            recommendationId: `R-${recommendationCounter}`,
            recommendation: rec?.recommendation || "Unknown",
            recommendationSource: rec?.source || "Unknown",
          });
          recommendationCounter++;
        });
      } else {
        // If no recommendations, still push a row with empty recommendation
        csvData.push({
          ...baseRowData,
          recommendationId: `R-${recommendationCounter}`,
          recommendation: "N/A",
          recommendationSource: "N/A",
        });
        recommendationCounter++;
      }
    });
    
    heuristicCounter++;
  });

  return csvData;
}

export function downloadCSV(data: CSVRow[], filename: string) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    toast.error(
      "No data available to export. Please make sure your study has evaluation results.",
    );
    return;
  }

  if (!filename || filename.trim() === "") {
    filename = "heuristic-evaluation-export.csv";
  }

  try {
    // Define CSV headers
    const hasCategory = data.some((row) => row.heuristicCategory !== undefined);
    const hasLabel = data.some((row) => row.heuristicLabel !== undefined);
    const headers = [
      "Heuristic ID",
      ...(hasCategory ? ["Heuristic Category"] : []),
      ...(hasLabel ? ["Heuristic Label"] : []),
      "Heuristic",
      "Step",
      "Issue ID",
      "Issue",
      "Issue Source",
      "Recommendation ID",
      "Recommendation",
      "Recommendation Source",
    ];

    // Convert data to CSV format
    const csvContent = [
      headers.join(","),
      ...data.map((row) => {
        const rowData = [
          `"${(row.heuristicId || "").replace(/"/g, '""')}"`,
          ...(hasCategory
            ? [`"${(row.heuristicCategory || "").replace(/"/g, '""')}"`]
            : []),
          ...(hasLabel
            ? [`"${(row.heuristicLabel || "").replace(/"/g, '""')}"`]
            : []),
          `"${(row.heuristicName || "").replace(/"/g, '""')}"`,
          `"${row.step}"`,
          `"${(row.issueId || "").replace(/"/g, '""')}"`,
          `"${(row.reason || "").replace(/"/g, '""')}"`,
          `"${(row.reasonSource || "").replace(/"/g, '""')}"`,
          `"${(row.recommendationId || "").replace(/"/g, '""')}"`,
          `"${(row.recommendation || "").replace(/"/g, '""')}"`,
          `"${(row.recommendationSource || "").replace(/"/g, '""')}"`,
        ];
        return rowData.join(",");
      }),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      console.error("File download not supported in this browser");
      toast.error("File download not supported in this browser");
    }
  } catch (error) {
    console.error("Error creating CSV file:", error);
    toast.error("Error creating CSV file. Please try again.");
  }
}

export function downloadExcel(data: CSVRow[], filename: string) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    toast.error(
      "No data available to export. Please make sure your study has evaluation results.",
    );
    return;
  }

  if (!filename || filename.trim() === "") {
    filename = "heuristic-evaluation-export.xlsx";
  }

  try {
    // Define Excel headers
    const hasCategory = data.some((row) => row.heuristicCategory !== undefined);
    const hasLabel = data.some((row) => row.heuristicLabel !== undefined);
    const headers = [
      "Heuristic ID",
      ...(hasCategory ? ["Heuristic Category"] : []),
      ...(hasLabel ? ["Heuristic Label"] : []),
      "Heuristic",
      "Step",
      "Issue ID",
      "Issue",
      "Issue Source",
      "Recommendation ID",
      "Recommendation",
      "Recommendation Source",
    ];

    // Convert data to worksheet format
    const worksheetData = [
      headers,
      ...data.map((row) => {
        const rowData = [
          row.heuristicId || "",
          ...(hasCategory ? [row.heuristicCategory || ""] : []),
          ...(hasLabel ? [row.heuristicLabel || ""] : []),
          row.heuristicName || "",
          row.step || "",
          row.issueId || "",
          row.reason || "",
          row.reasonSource || "",
          row.recommendationId || "",
          row.recommendation || "",
          row.recommendationSource || "",
        ];
        return rowData;
      }),
    ];

    // Create a new workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 12 }, // Heuristic ID
      ...(hasCategory ? [{ wch: 20 }] : []), // Heuristic Category
      ...(hasLabel ? [{ wch: 20 }] : []), // Heuristic Label
      { wch: 30 }, // Heuristic
      { wch: 10 }, // Step
      { wch: 10 }, // Issue ID
      { wch: 40 }, // Issue
      { wch: 15 }, // Issue Source
      { wch: 15 }, // Recommendation ID
      { wch: 40 }, // Recommendation
      { wch: 15 }, // Recommendation Source
    ];
    worksheet["!cols"] = columnWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Heuristic Evaluation");

    // Generate the Excel file
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    // Create and download the file
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      console.error("File download not supported in this browser");
      toast.error("File download not supported in this browser");
    }
  } catch (error) {
    console.error("Error creating Excel file:", error);
    toast.error("Error creating Excel file. Please try again.");
  }
}
