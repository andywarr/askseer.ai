"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/apps/nextjs-app/components/ui/input";

interface DollarInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

export function DollarInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  min = 0.01,
  max,
}: DollarInputProps) {
  // Track the previous value so we can detect spinner clicks and
  // apply ±$1.00 from the actual value instead of the browser's
  // step-from-min behaviour.
  const prevRef = useRef(value);
  prevRef.current = value;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const prev = parseFloat(prevRef.current) || 0;
      const next = parseFloat(raw);

      // If the browser produced a value that looks like it came from the
      // native stepper (jumped to a whole-dollar step boundary) rather
      // than the user typing, correct it to prev ± 1.00.
      if (
        Number.isFinite(next) &&
        Number.isFinite(prev) &&
        raw !== prevRef.current
      ) {
        const diff = next - prev;
        // Spinner click produces a diff that is roughly +1 or -1 from the
        // step-aligned value.  Detect it by checking if the result lost
        // the fractional part the previous value had.
        const prevFrac = prev % 1;
        const nextFrac = next % 1;
        const lostFraction =
          Math.abs(prevFrac) > 0.001 && Math.abs(nextFrac) < 0.001;

        if (lostFraction) {
          // Determine direction and apply ±1 to the real previous value
          const direction = diff > 0 ? 1 : -1;
          let corrected = prev + direction;
          if (max != null && corrected > max) corrected = max;
          if (corrected >= min) {
            onChange(corrected.toFixed(2));
          }
          return;
        }

        // Spinner on a whole-number value (e.g. 1.00 → 2): the browser
        // strips the decimals. Detect by checking diff ≈ ±1 and the raw
        // string has no decimal point.
        if (Math.abs(Math.abs(diff) - 1) < 0.001 && !raw.includes(".")) {
          const corrected = prev + (diff > 0 ? 1 : -1);
          if (corrected >= min) {
            onChange(corrected.toFixed(2));
          }
          return;
        }
      }

      onChange(raw);
    },
    [onChange, min, max],
  );

  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground text-sm">$</span>
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        className="text-center"
        style={{ width: `${Math.max(value.length + 5, 8)}ch` }}
      />
    </div>
  );
}
