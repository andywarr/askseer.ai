"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import { cn } from "@/apps/nextjs-app/lib/utils";

type HeuristicFamily = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  companyId: string | null;
};

export interface HeuristicSelectProps {
  heuristicFamilies: HeuristicFamily[];
  /** Selected heuristic family id */
  selectedId?: string | null;
  /** Change handler when a heuristic family is selected */
  onChange: (update: {
    selectedId: string | null;
    family?: HeuristicFamily | null;
  }) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function HeuristicSelect({
  heuristicFamilies,
  selectedId,
  onChange,
  disabled,
  placeholder = "Select a heuristic set e.g., Nielsens 10 Usability Heuristics",
}: HeuristicSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const selected = heuristicFamilies.find((f) => f.id === selectedId) || null;

  // Display value combines selection and search
  const displayValue = searchValue || (selected ? selected.name : "");

  // Group heuristic families into Seer (global) and Company (custom)
  const seerFamilies = heuristicFamilies.filter((f) => !f.companyId);
  const companyFamilies = heuristicFamilies.filter((f) => f.companyId);

  const closeList = () => {
    inputRef.current?.blur();
    setOpen(false);
  };

  // When a selection is made, clear the search
  const handleSelect = (family: HeuristicFamily) => {
    onChange({
      selectedId: family.id,
      family: family,
    });
    setSearchValue("");
    closeList();
  };

  return (
    <div
      ref={wrapperRef}
      className={cn("group w-full", disabled && "opacity-50")}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) {
          setOpen(false);
        }
      }}
    >
      <Command className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <CommandInput
          placeholder={placeholder}
          value={displayValue}
          disabled={disabled}
          hideIcon
          ref={inputRef}
          onValueChange={(v) => {
            setSearchValue(v);
            // Clear selection when user starts typing
            if (v && selected) {
              onChange({ selectedId: null, family: null });
            }
          }}
        />
        <CommandList className={cn(open ? "block" : "hidden")}>
          <CommandEmpty>No heuristic families found.</CommandEmpty>

          {/* Seer Heuristics Group */}
          {seerFamilies.length > 0 && (
            <CommandGroup heading="Seer Heuristics">
              {seerFamilies.map((f) => {
                return (
                  <CommandItem
                    key={f.id}
                    value={`${f.name} ${f.description || ""}`}
                    onSelect={() => handleSelect(f)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {f.name}
                      </div>
                      {f.description ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {f.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Company Heuristics Group */}
          {companyFamilies.length > 0 && (
            <CommandGroup heading="Company Heuristics">
              {companyFamilies.map((f) => {
                return (
                  <CommandItem
                    key={f.id}
                    value={`${f.name} ${f.description || ""}`}
                    onSelect={() => handleSelect(f)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {f.name}
                      </div>
                      {f.description ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {f.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
