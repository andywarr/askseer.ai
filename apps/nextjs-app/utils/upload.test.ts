import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isOffline,
  uploadFilesWithConcurrencyLimit,
  UploadError,
} from "./upload";

describe("upload utilities", () => {
  describe("uploadFilesWithConcurrencyLimit", () => {
    it("should process all items", async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];

      await uploadFilesWithConcurrencyLimit(items, async (item) => {
        processed.push(item);
      });

      expect(processed).toEqual([1, 2, 3, 4, 5]);
    });

    it("should respect maxConcurrency limit", async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const concurrencyTracker: number[] = [];
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      await uploadFilesWithConcurrencyLimit(
        items,
        async () => {
          currentConcurrency++;
          maxObservedConcurrency = Math.max(
            maxObservedConcurrency,
            currentConcurrency,
          );
          concurrencyTracker.push(currentConcurrency);

          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 10));

          currentConcurrency--;
        },
        { maxConcurrency: 2 },
      );

      // Should never exceed max concurrency
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    });

    it("should use default maxConcurrency of 5", async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      await uploadFilesWithConcurrencyLimit(items, async () => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(
          maxObservedConcurrency,
          currentConcurrency,
        );

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 5));

        currentConcurrency--;
      });

      // Default is 5 concurrent uploads
      expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
    });

    it("should pass correct index to upload function", async () => {
      const items = ["a", "b", "c"];
      const results: Array<{ item: string; index: number }> = [];

      await uploadFilesWithConcurrencyLimit(items, async (item, index) => {
        results.push({ item, index });
      });

      expect(results).toEqual([
        { item: "a", index: 0 },
        { item: "b", index: 1 },
        { item: "c", index: 2 },
      ]);
    });

    it("should handle empty array", async () => {
      const items: number[] = [];
      const uploadFn = vi.fn();

      await uploadFilesWithConcurrencyLimit(items, uploadFn);

      expect(uploadFn).not.toHaveBeenCalled();
    });

    it("should propagate errors from upload function", async () => {
      const items = [1, 2, 3];
      const error = new Error("Upload failed");

      await expect(
        uploadFilesWithConcurrencyLimit(items, async (item) => {
          if (item === 2) {
            throw error;
          }
        }),
      ).rejects.toThrow("Upload failed");
    });

    it("should handle single item", async () => {
      const items = ["single"];
      const results: string[] = [];

      await uploadFilesWithConcurrencyLimit(items, async (item) => {
        results.push(item);
      });

      expect(results).toEqual(["single"]);
    });
  });

  describe("UploadError", () => {
    it("should create error with default values", () => {
      const error = new UploadError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("UploadError");
      expect(error.isOffline).toBe(false);
      expect(error.isNetworkError).toBe(false);
      expect(error.fileName).toBeUndefined();
      expect(error.retriesAttempted).toBe(0);
    });

    it("should create error with custom options", () => {
      const error = new UploadError("Network error", {
        isOffline: true,
        isNetworkError: true,
        fileName: "test.png",
        retriesAttempted: 3,
      });

      expect(error.message).toBe("Network error");
      expect(error.isOffline).toBe(true);
      expect(error.isNetworkError).toBe(true);
      expect(error.fileName).toBe("test.png");
      expect(error.retriesAttempted).toBe(3);
    });
  });
});
