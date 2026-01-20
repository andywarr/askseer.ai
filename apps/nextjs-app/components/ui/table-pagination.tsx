"use client";

import { useCallback, useMemo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/apps/nextjs-app/components/ui/pagination";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface TablePaginationProps {
  /** Current page index (0-based) */
  pageIndex: number;
  /** Current page size */
  pageSize: number;
  /** Total number of pages */
  pageCount: number;
  /** Can navigate to previous page */
  canPreviousPage: boolean;
  /** Can navigate to next page */
  canNextPage: boolean;
  /** Callback when navigating to previous page */
  onPreviousPage: () => void;
  /** Callback when navigating to next page */
  onNextPage: () => void;
  /** Callback when changing to specific page */
  onPageChange: (pageIndex: number) => void;
  /** Callback when changing page size */
  onPageSizeChange: (pageSize: number) => void;
  /** Label for the "per page" selector, e.g., "Teams per page" */
  pageSizeLabel?: string;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Optional total count to display */
  totalCount?: number;
  /** Label for total count (singular), e.g., "entry" */
  totalLabel?: string;
  /** Label for total count (plural), e.g., "entries" */
  totalLabelPlural?: string;
  /** Whether to disable controls during loading */
  disabled?: boolean;
  /** Maximum number of page buttons to show before truncation */
  maxVisiblePages?: number;
  /** Unique key prefix for pagination items */
  keyPrefix?: string;
}

/**
 * Helper to get visible page numbers with ellipsis support for large page counts
 */
function getVisiblePageNumbers(
  currentPageIndex: number,
  totalPages: number,
  maxVisible: number = 5
): number[] {
  const pageCount = Math.max(totalPages, 1);
  const pages: number[] = [];

  if (pageCount <= maxVisible) {
    // Show all pages if count is small
    for (let i = 0; i < pageCount; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Calculate sliding window
  let start = Math.max(0, currentPageIndex - Math.floor(maxVisible / 2));
  const end = Math.min(pageCount, start + maxVisible);

  if (end - start < maxVisible) {
    start = Math.max(0, end - maxVisible);
  }

  for (let i = start; i < end; i++) {
    pages.push(i);
  }

  return pages;
}

/**
 * Reusable table pagination component with page navigation and page size selector.
 * Used across settings pages for consistent pagination UX.
 */
export function TablePagination({
  pageIndex,
  pageSize,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onPageChange,
  onPageSizeChange,
  pageSizeLabel = "Per page:",
  pageSizeOptions = [5, 10, 20, 50],
  totalCount,
  totalLabel = "item",
  totalLabelPlural = "items",
  disabled = false,
  maxVisiblePages = 7,
  keyPrefix = "page",
}: TablePaginationProps) {
  const visiblePages = useMemo(
    () => getVisiblePageNumbers(pageIndex, pageCount, maxVisiblePages),
    [pageIndex, pageCount, maxVisiblePages]
  );

  const handlePreviousClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (canPreviousPage && !disabled) {
        onPreviousPage();
      }
    },
    [canPreviousPage, disabled, onPreviousPage]
  );

  const handleNextClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (canNextPage && !disabled) {
        onNextPage();
      }
    },
    [canNextPage, disabled, onNextPage]
  );

  const handlePageClick = useCallback(
    (event: React.MouseEvent, index: number) => {
      event.preventDefault();
      if (!disabled) {
        onPageChange(index);
      }
    },
    [disabled, onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (value: string) => {
      onPageSizeChange(Number(value));
    },
    [onPageSizeChange]
  );

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Pagination className="justify-start sm:justify-start">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={handlePreviousClick}
              aria-disabled={!canPreviousPage || disabled}
              className={cn(
                (!canPreviousPage || disabled) &&
                  "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>
          {visiblePages.map((index) => (
            <PaginationItem key={`${keyPrefix}-${index}`}>
              <PaginationLink
                href="#"
                isActive={pageIndex === index}
                onClick={(event) => handlePageClick(event, index)}
                className={cn(disabled && "pointer-events-none")}
              >
                {index + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={handleNextClick}
              aria-disabled={!canNextPage || disabled}
              className={cn(
                (!canNextPage || disabled) && "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <div className="flex items-center gap-4 sm:justify-end sm:pl-4">
        {totalCount !== undefined && (
          <span className="text-muted-foreground text-sm">
            {totalCount} {totalCount === 1 ? totalLabel : totalLabelPlural}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{pageSizeLabel}</span>
          <Select
            value={String(pageSize)}
            onValueChange={handlePageSizeChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem
                  key={`${keyPrefix}-size-${size}`}
                  value={String(size)}
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/**
 * Convenience wrapper for use with @tanstack/react-table
 */
export interface TablePaginationWithTableProps {
  table: {
    getCanPreviousPage: () => boolean;
    getCanNextPage: () => boolean;
    previousPage: () => void;
    nextPage: () => void;
    setPageIndex: (index: number) => void;
    getState: () => {
      pagination: {
        pageIndex: number;
        pageSize: number;
      };
    };
    getPageCount: () => number;
  };
  onPageSizeChange: (pageSize: number) => void;
  pageSizeLabel?: string;
  pageSizeOptions?: number[];
  totalCount?: number;
  totalLabel?: string;
  totalLabelPlural?: string;
  disabled?: boolean;
  maxVisiblePages?: number;
  keyPrefix?: string;
}

/**
 * Simplified pagination component that directly integrates with react-table
 */
export function TablePaginationWithTable({
  table,
  onPageSizeChange,
  pageSizeLabel,
  pageSizeOptions,
  totalCount,
  totalLabel,
  totalLabelPlural,
  disabled,
  maxVisiblePages,
  keyPrefix,
}: TablePaginationWithTableProps) {
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <TablePagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      pageCount={Math.max(table.getPageCount(), 1)}
      canPreviousPage={table.getCanPreviousPage()}
      canNextPage={table.getCanNextPage()}
      onPreviousPage={table.previousPage}
      onNextPage={table.nextPage}
      onPageChange={table.setPageIndex}
      onPageSizeChange={onPageSizeChange}
      pageSizeLabel={pageSizeLabel}
      pageSizeOptions={pageSizeOptions}
      totalCount={totalCount}
      totalLabel={totalLabel}
      totalLabelPlural={totalLabelPlural}
      disabled={disabled}
      maxVisiblePages={maxVisiblePages}
      keyPrefix={keyPrefix}
    />
  );
}
