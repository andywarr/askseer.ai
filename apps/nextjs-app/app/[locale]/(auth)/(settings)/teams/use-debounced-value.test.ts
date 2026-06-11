import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 300));

    expect(result.current).toBe("initial");
  });

  it("should debounce value changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "first" } }
    );

    expect(result.current).toBe("first");

    // Update the value
    rerender({ value: "second" });

    // Value should not have changed yet
    expect(result.current).toBe("first");

    // Fast-forward time by 200ms (less than delay)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("first");

    // Fast-forward remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("second");
  });

  it("should reset timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "c" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "d" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Value should still be "a" since timer keeps resetting
    expect(result.current).toBe("a");

    // Wait full delay after last change
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("d");
  });

  it("should use default delay of 300ms", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: "initial" } }
    );

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");
  });

  it("should work with different types", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 100),
      { initialProps: { value: 42 as number } }
    );

    expect(result.current).toBe(42);

    rerender({ value: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(100);
  });
});
