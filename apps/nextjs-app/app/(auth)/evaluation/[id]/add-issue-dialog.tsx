import { useState, ReactNode } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/apps/nextjs-app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { getSeverityInfo } from "@/apps/nextjs-app/utils/severity";
import type { SeverityRating } from "@/apps/nextjs-app/utils/severity";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface AddIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    stepIndex: number,
    description: string,
    severity: number,
  ) => Promise<void>;
  presignedUrls: string[];
  triggerButton: ReactNode;
}

export function AddIssueDialog({
  open,
  onOpenChange,
  onSubmit,
  presignedUrls,
  triggerButton,
}: AddIssueDialogProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<number | null>(null);

  const handleSubmit = async () => {
    if (selectedImageIndex === null || !description.trim() || severity === null)
      return;

    await onSubmit(selectedImageIndex, description, severity);
    setSelectedImageIndex(null);
    setDescription("");
    setSeverity(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedImageIndex(null);
      setDescription("");
      setSeverity(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <label className="mb-2 block font-medium">
            Which step is the issue?
          </label>
          <Select
            value={
              selectedImageIndex !== null ? String(selectedImageIndex) : ""
            }
            onValueChange={(val) => setSelectedImageIndex(Number(val))}
          >
            <SelectTrigger className="h-9 w-full">
              {selectedImageIndex !== null ? (
                <div className="flex items-center gap-2">
                  <Image
                    src={presignedUrls[selectedImageIndex]}
                    alt={`Step ${selectedImageIndex + 1}`}
                    width={48}
                    height={48}
                    className="rounded border object-contain"
                    priority
                    unoptimized
                  />
                  <span>Step {selectedImageIndex + 1}</span>
                </div>
              ) : (
                <span className="text-zinc-500">Choose a step...</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {presignedUrls.map((url, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  <div className="flex items-center gap-2">
                    <Image
                      src={url}
                      alt={`Step ${idx + 1}`}
                      width={128}
                      height={128}
                      className="rounded border object-contain"
                      priority
                      unoptimized
                    />
                    <span>Step {idx + 1}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-4">
          <label className="mb-2 block font-medium">What is the issue?</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            rows={5}
            className="resize-none"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block font-medium">
            How severe is the issue?
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {severity !== null ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "cursor-pointer font-medium transition-opacity hover:opacity-80",
                    getSeverityInfo(severity)?.bgColor,
                    getSeverityInfo(severity)?.borderColor,
                    getSeverityInfo(severity)?.textColor,
                  )}
                >
                  {getSeverityInfo(severity)?.label}
                </Badge>
              ) : (
                <Button variant="outline" className="justify-start">
                  <span className="text-zinc-500">Select severity...</span>
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {([0, 1, 2, 3, 4] as SeverityRating[]).map((level) => {
                const info = getSeverityInfo(level);
                if (!info) return null;
                return (
                  <DropdownMenuItem
                    key={level}
                    onClick={() => setSeverity(level)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("h-3 w-3 rounded-full", info.bgColor)}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{info.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {info.description}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          className="w-full"
          disabled={
            selectedImageIndex === null ||
            !description.trim() ||
            severity === null
          }
          onClick={handleSubmit}
        >
          Add
        </Button>
      </DialogContent>
    </Dialog>
  );
}
