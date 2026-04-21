"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Check } from "lucide-react";
import { handleTransferStudy } from "@/apps/nextjs-app/lib/actions/study-actions";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

export interface AdminTeam {
  id: string;
  name: string;
  isPersonal: boolean;
}

interface TransferStudyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  currentTeamId: string | null;
  adminTeams: AdminTeam[];
}

export function TransferStudyModal({
  open,
  onOpenChange,
  studyId,
  currentTeamId,
  adminTeams,
}: TransferStudyModalProps) {
  const router = useRouter();
  const selectableTeams = adminTeams.filter((t) => t.id !== currentTeamId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() =>
    selectableTeams.length === 1 ? selectableTeams[0].id : null,
  );
  const [isTransferring, setIsTransferring] = useState(false);
  const [inputValue, setInputValue] = useState(() =>
    selectableTeams.length === 1 ? (selectableTeams[0].name ?? "") : "",
  );
  const [listOpen, setListOpen] = useState(false);
  const currentTeamName = adminTeams.find((t) => t.id === currentTeamId)?.name;

  const handleTransfer = async () => {
    if (!selectedTeamId || selectedTeamId === currentTeamId) return;

    setIsTransferring(true);
    try {
      const result = await handleTransferStudy(studyId, selectedTeamId);
      if (result.success) {
        toast.success("Study transferred successfully");
        onOpenChange(false);
        router.push("/studies");
      } else {
        toast.error(result.error ?? "Failed to transfer study");
      }
    } catch {
      toast.error("Failed to transfer study");
    } finally {
      setIsTransferring(false);
    }
  };

  const canConfirm =
    !!selectedTeamId && selectedTeamId !== currentTeamId && !isTransferring;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Study
          </DialogTitle>
          <DialogDescription>
            Select the team you want to transfer this study to.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex flex-col gap-3">
          <div className="relative">
            <Command className="rounded-md border" shouldFilter>
              <CommandInput
                placeholder="Search teams…"
                value={inputValue}
                onValueChange={setInputValue}
                onFocus={() => setListOpen(true)}
                onBlur={() => setListOpen(false)}
              />
              {listOpen && (
                <CommandList
                  className="absolute top-full right-0 left-0 z-50 mt-px rounded-b-md border-x border-b bg-white shadow-md dark:bg-zinc-950"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <CommandEmpty>No teams found.</CommandEmpty>
                  <CommandGroup>
                    {selectableTeams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.name}
                        onSelect={() => {
                          setSelectedTeamId(team.id);
                          setInputValue(team.name);
                          setListOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeamId === team.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {team.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              )}
            </Command>
          </div>
          {currentTeamName && (
            <p className="text-sm text-zinc-500">
              Current Team:{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {currentTeamName}
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isTransferring}
          >
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!canConfirm}>
            {isTransferring ? "Transferring…" : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
