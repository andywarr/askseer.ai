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
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { Button } from "@/apps/nextjs-app/components/ui/button";

interface AddIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (stepIndex: number, description: string) => Promise<void>;
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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (selectedImageIndex === null || !description.trim()) return;
    
    await onSubmit(selectedImageIndex, description);
    setSelectedImageIndex(null);
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedImageIndex(null);
      setDescription("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
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
              selectedImageIndex !== null
                ? String(selectedImageIndex)
                : ""
            }
            onValueChange={(val) =>
              setSelectedImageIndex(Number(val))
            }
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
                <span className="text-zinc-500">
                  Choose a step...
                </span>
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
          <label className="mb-2 block font-medium">
            What is the issue?
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            rows={4}
          />
        </div>
        <Button
          className="w-full"
          disabled={
            selectedImageIndex === null ||
            !description.trim()
          }
          onClick={handleSubmit}
        >
          Add
        </Button>
      </DialogContent>
    </Dialog>
  );
}
