"use client";

import * as React from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { cn } from "@/apps/nextjs-app/lib/utils";

type PersonaStudy = {
  id: string;
  name: string | null;
  persona?: {
    name?: string | null;
    description?: string | null;
    photoFile?: { key?: string | null } | null;
    data?: any;
  } | null;
};

export interface PersonaSelectProps {
  personas: PersonaStudy[];
  /** Selected persona study id. When set, the control shows the persona. */
  selectedId?: string | null;
  /** Free text description value when not using a persona */
  inputValue: string;
  /** Unified change handler for both persona selection and free text typing */
  onChange: (update: {
    selectedId: string | null;
    inputValue: string;
    persona?: PersonaStudy | null;
  }) => void;
  getImageUrl?: (key: string) => Promise<string> | string;
  disabled?: boolean;
  placeholder?: string;
  /** When true, render an inline Command input instead of a popover trigger */
  inline?: boolean;
}

export function PersonaSelect({
  personas,
  selectedId,
  inputValue,
  onChange,
  getImageUrl,
  disabled,
  placeholder = "Select or type a user",
  inline = true,
}: PersonaSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selected = personas.find((p) => p.id === selectedId) || null;
  const displayName = selected
    ? selected?.persona?.name || selected?.name || ""
    : inputValue?.trim() || placeholder;
  const displayedInput = selected
    ? `${selected.persona?.name || selected.name || ""}${selected?.persona?.description ? ` — ${selected.persona.description}` : ""}`
    : inputValue;
  const selectedDesc = selected?.persona?.description || "";
  const [imageUrlMap, setImageUrlMap] = React.useState<Record<string, string>>(
    {},
  );
  const selectedImg = selected ? imageUrlMap[selected.id] : "";
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [inlineOpen, setInlineOpen] = React.useState(false);

  const closeInlineList = () => {
    // Blur input to remove :focus-within and hide list
    inputRef.current?.blur();
    setInlineOpen(false);
  };

  React.useEffect(() => {
    async function load() {
      if (!getImageUrl) return;
      const entries = await Promise.all(
        personas.map(async (p) => {
          const key = p.persona?.photoFile?.key;
          if (key) {
            try {
              const url = await getImageUrl(key);
              return [p.id, String(url)] as const;
            } catch {
              return [p.id, ""] as const;
            }
          }
          return [p.id, ""] as const;
        }),
      );
      const map: Record<string, string> = {};
      for (const [id, url] of entries) map[id] = url;
      setImageUrlMap(map);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas.length, getImageUrl]);

  // Inline mode: hide options until the input is focused (selected)
  if (inline) {
    return (
      <div
        ref={wrapperRef}
        className={cn("group w-full", disabled && "opacity-50")}
        onFocus={() => setInlineOpen(true)}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(next)) {
            setInlineOpen(false);
          }
        }}
      >
        <Command className="rounded-md border border-zinc-200 dark:border-zinc-800">
          <CommandInput
            placeholder={placeholder}
            value={displayedInput}
            disabled={disabled}
            hideIcon
            leftSlot={
              selected ? (
                <Avatar className="h-6 w-6">
                  {selectedImg ? (
                    <AvatarImage src={selectedImg} alt={displayedInput} />
                  ) : null}
                  <AvatarFallback>
                    {(displayedInput || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : undefined
            }
            ref={inputRef}
            onValueChange={(v) =>
              onChange({ selectedId: null, inputValue: v, persona: null })
            }
          />
          <CommandList className={cn(inlineOpen ? "block" : "hidden")}>
            <CommandEmpty>No personas found.</CommandEmpty>
            <CommandGroup>
              {inputValue?.trim() ? (
                <CommandItem
                  key="__use_text__"
                  value={inputValue}
                  onSelect={() => {
                    onChange({ selectedId: null, inputValue, persona: null });
                    closeInlineList();
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      Use: {inputValue}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      Free-text description
                    </div>
                  </div>
                </CommandItem>
              ) : null}
              {selected ? (
                <CommandItem
                  key="__clear__"
                  value="Clear selection"
                  onSelect={() => {
                    onChange({
                      selectedId: null,
                      inputValue: "",
                      persona: null,
                    });
                    closeInlineList();
                  }}
                >
                  <div className="truncate text-sm">Clear selection</div>
                </CommandItem>
              ) : null}
              {personas.map((p) => {
                const name = p.persona?.name || p.name || "Untitled persona";
                const desc = p.persona?.description || "";
                const img = imageUrlMap[p.id] || "";
                return (
                  <CommandItem
                    key={p.id}
                    value={`${name} ${desc}`}
                    onSelect={() => {
                      onChange({
                        selectedId: p.id,
                        inputValue: "",
                        persona: p,
                      });
                      closeInlineList();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-6 w-6">
                        {img ? <AvatarImage src={img} alt={name} /> : null}
                        <AvatarFallback>
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {name}
                        </div>
                        {desc ? (
                          <div className="text-muted-foreground truncate text-xs">
                            {desc}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    );
  }

  // Popover mode remains available if needed elsewhere
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start",
            !selected && !inputValue && "text-muted-foreground",
          )}
          disabled={disabled}
        >
          {selected ? (
            <div className="flex items-center gap-3 truncate">
              <Avatar className="h-6 w-6">
                {selected.persona?.photoFile?.key ? (
                  <AvatarImage
                    src={imageUrlMap[selected.id]}
                    alt={displayName || ""}
                  />
                ) : null}
                <AvatarFallback>
                  {(displayName || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="truncate text-sm font-medium">
                  {displayName}
                </div>
                {selected?.persona?.description ? (
                  <div className="text-muted-foreground truncate text-xs">
                    {selected.persona.description}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <span className="truncate">{displayName}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search personas or type a description..."
            value={displayedInput}
            hideIcon
            leftSlot={
              selected ? (
                <Avatar className="h-6 w-6">
                  {selectedImg ? (
                    <AvatarImage src={selectedImg} alt={displayedInput} />
                  ) : null}
                  <AvatarFallback>
                    {(displayedInput || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : undefined
            }
            onValueChange={(v) =>
              onChange({ selectedId: null, inputValue: v, persona: null })
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                setOpen(false);
              }
            }}
          />
          <CommandList className="max-h-64 overflow-auto">
            <CommandEmpty>No personas found.</CommandEmpty>
            <CommandGroup>
              {inputValue?.trim() ? (
                <CommandItem
                  key="__use_text__"
                  value={inputValue}
                  onSelect={() => {
                    onChange({ selectedId: null, inputValue, persona: null });
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      Use: {inputValue}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      Free-text description
                    </div>
                  </div>
                </CommandItem>
              ) : null}
              {selected ? (
                <CommandItem
                  key="__clear__"
                  value="Clear selection"
                  onSelect={() => {
                    onChange({
                      selectedId: null,
                      inputValue: "",
                      persona: null,
                    });
                    setOpen(false);
                  }}
                >
                  <div className="truncate text-sm">Clear selection</div>
                </CommandItem>
              ) : null}
              {personas.map((p) => {
                const name = p.persona?.name || p.name || "Untitled persona";
                const desc = p.persona?.description || "";
                const img = imageUrlMap[p.id] || "";
                return (
                  <CommandItem
                    key={p.id}
                    value={`${name} ${desc}`}
                    onSelect={() => {
                      onChange({
                        selectedId: p.id,
                        inputValue: "",
                        persona: p,
                      });
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-6 w-6">
                        {img ? <AvatarImage src={img} alt={name} /> : null}
                        <AvatarFallback>
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {name}
                        </div>
                        {desc ? (
                          <div className="text-muted-foreground truncate text-xs">
                            {desc}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
