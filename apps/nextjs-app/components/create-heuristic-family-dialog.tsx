"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";

interface CreateHeuristicFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, key: string, description?: string) => Promise<void>;
}

export function CreateHeuristicFamilyDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateHeuristicFamilyDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !key.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), key.trim(), description.trim() || undefined);
      // Reset form
      setName("");
      setKey("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate key if it hasn't been manually edited
    if (!key || key === generateKey(name)) {
      setKey(generateKey(value));
    }
  };

  const generateKey = (text: string) => {
    return text
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Heuristic Set</DialogTitle>
            <DialogDescription>
              Create a new custom heuristic family for your company. You can add
              individual heuristics to this family after creating it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp UX Principles"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key">Key *</Label>
              <Input
                id="key"
                placeholder="e.g., ACME_CORP_UX_PRINCIPLES"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                required
              />
              <p className="text-muted-foreground text-xs">
                A unique identifier for this heuristic set (auto-generated from
                name)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe this heuristic set and when to use it..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !key.trim()}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
