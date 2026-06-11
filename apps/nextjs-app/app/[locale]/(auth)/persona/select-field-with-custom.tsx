"use client";

import { memo, useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";

export type SelectFieldWithCustomProps = {
  /** Form field name, e.g. "demographics.age" */
  name: string;
  /** Label displayed above the field */
  label: string;
  /** Options for the select dropdown */
  options: readonly string[];
  /** Placeholder for select dropdown */
  placeholder?: string;
  /** Placeholder for custom input */
  customPlaceholder?: string;
  /** Whether to show custom input mode */
  isCustomMode: boolean;
  /** Callback to toggle custom mode */
  onToggleCustomMode: (value: boolean) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Optional className for FormItem */
  className?: string;
};

/**
 * A reusable form field that combines a select dropdown with a custom input toggle.
 * Reduces duplication across persona form fields.
 */
function SelectFieldWithCustomBase({
  name,
  label,
  options,
  placeholder = "Select option",
  customPlaceholder = "Enter custom value",
  isCustomMode,
  onToggleCustomMode,
  disabled = false,
  className,
}: SelectFieldWithCustomProps) {
  const form = useFormContext();

  const handleToggleToCustom = useCallback(() => {
    onToggleCustomMode(true);
  }, [onToggleCustomMode]);

  const handleToggleToPresets = useCallback(() => {
    onToggleCustomMode(false);
  }, [onToggleCustomMode]);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          {!isCustomMode ? (
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(v) => field.onChange(v)}
                value={field.value || undefined}
                disabled={disabled}
                key={`${name}-${disabled ? "disabled" : "enabled"}-${field.value || "empty"}`}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-zinc-500"
                disabled={disabled}
                onClick={handleToggleToCustom}
              >
                Enter custom value
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  placeholder={customPlaceholder}
                  value={field.value || ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                />
              </FormControl>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-zinc-500"
                disabled={disabled}
                onClick={handleToggleToPresets}
              >
                Use presets
              </Button>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export const SelectFieldWithCustom = memo(SelectFieldWithCustomBase);
SelectFieldWithCustom.displayName = "SelectFieldWithCustom";
