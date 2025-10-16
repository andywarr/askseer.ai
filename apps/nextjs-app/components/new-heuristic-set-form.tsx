"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  createHeuristicFamily,
  createHeuristic,
} from "@/apps/nextjs-app/lib/actions/heuristic-actions";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Loader2, X, GripVertical } from "lucide-react";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { toast } from "sonner";
import { useDrag, useDrop } from "react-dnd";
import type { Identifier } from "dnd-core";

interface Heuristic {
  id: string;
  label: string;
  category?: string;
  heuristic: string;
}

interface NewHeuristicSetFormProps {
  companyId: string;
}

const HEURISTIC_ITEM_TYPE = "heuristic";

interface DragItem {
  index: number;
  id: string;
}

interface DraggableHeuristicItemProps {
  heuristic: Heuristic;
  index: number;
  moveHeuristic: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (id: string) => void;
}

function DraggableHeuristicItem({
  heuristic,
  index,
  moveHeuristic,
  onRemove,
}: DraggableHeuristicItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: HEURISTIC_ITEM_TYPE,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      moveHeuristic(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: HEURISTIC_ITEM_TYPE,
    item: () => {
      return { index, id: heuristic.id };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className={`group ${isDragging ? "opacity-50" : ""} transition-opacity`}
    >
      <div className="flex items-start gap-2">
        <div className="cursor-move pt-1">
          <GripVertical className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="flex flex-1 items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{heuristic.label}</h4>
              {heuristic.category && (
                <Badge variant="secondary" className="text-xs">
                  {heuristic.category}
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {heuristic.heuristic}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(heuristic.id)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NewHeuristicSetForm({ companyId }: NewHeuristicSetFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>("");

  // Heuristic form state
  const [heuristics, setHeuristics] = useState<Heuristic[]>([]);
  const [newHeuristicLabel, setNewHeuristicLabel] = useState("");
  const [newHeuristicCategory, setNewHeuristicCategory] = useState("");
  const [newHeuristicText, setNewHeuristicText] = useState("");
  const [heuristicError, setHeuristicError] = useState<string>("");

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    setName(value);
  };

  const generateKey = (text: string) => {
    return text
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddHeuristic = () => {
    setHeuristicError("");

    if (!newHeuristicLabel.trim() || !newHeuristicText.trim()) {
      setHeuristicError("Please provide both a label and heuristic text");
      return;
    }

    const newHeuristic: Heuristic = {
      id: crypto.randomUUID(),
      label: newHeuristicLabel.trim(),
      category: newHeuristicCategory.trim() || undefined,
      heuristic: newHeuristicText.trim(),
    };

    setHeuristics([...heuristics, newHeuristic]);
    setNewHeuristicLabel("");
    setNewHeuristicCategory("");
    setNewHeuristicText("");
  };

  const handleRemoveHeuristic = (id: string) => {
    setHeuristics(heuristics.filter((h) => h.id !== id));
  };

  const moveHeuristic = (dragIndex: number, hoverIndex: number) => {
    const updatedHeuristics = [...heuristics];
    const [draggedItem] = updatedHeuristics.splice(dragIndex, 1);
    updatedHeuristics.splice(hoverIndex, 0, draggedItem);
    setHeuristics(updatedHeuristics);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Please provide a name for the heuristic set");
      return;
    }

    if (heuristics.length === 0) {
      setFormError("Please add at least one heuristic");
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate key from name
      const generatedKey = generateKey(name.trim());

      // First create the heuristic family using server action
      const familyData = await createHeuristicFamily({
        name: name.trim(),
        key: generatedKey,
        description: description.trim() || undefined,
        companyId,
      });

      if (!familyData.success) {
        throw new Error(familyData.message || "Failed to create heuristic set");
      }

      const familyId = familyData.data.id;

      // Then create each heuristic using server action
      for (const heuristic of heuristics) {
        try {
          await createHeuristic({
            heuristicFamilyId: familyId,
            label: heuristic.label,
            category: heuristic.category,
            heuristic: heuristic.heuristic,
            companyId,
          });
        } catch (heuristicError) {
          console.error(
            `Failed to create heuristic: ${heuristic.label}`,
            heuristicError,
          );
          // Continue with other heuristics even if one fails
        }
      }

      toast.success("Heuristic set created successfully");
      router.push("/library");
      router.refresh();
    } catch (error) {
      console.error("Error creating heuristic set:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to create heuristic set",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="mb-4 text-sm font-semibold">Information</h3>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4">
            <div>
              <Label htmlFor="name" className="mb-2 block">
                Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp UX Principles"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe this heuristic set and when to use it..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <Separator className="my-6" />

      {/* Add Heuristic */}
      <div>
        <h3 className="mb-4 text-sm font-semibold">Heuristics</h3>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-y-4">
            <div>
              <Label htmlFor="heuristic-label" className="mb-2 block">
                Label
              </Label>
              <Input
                id="heuristic-label"
                placeholder="e.g., Visibility of system status"
                value={newHeuristicLabel}
                onChange={(e) => setNewHeuristicLabel(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="heuristic-category" className="mb-2 block">
                Category
              </Label>
              <Input
                id="heuristic-category"
                placeholder="e.g., 1, Usability, Design"
                value={newHeuristicCategory}
                onChange={(e) => setNewHeuristicCategory(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="heuristic-text" className="mb-2 block">
                Heuristic
              </Label>
              <Textarea
                id="heuristic-text"
                placeholder="Describe the heuristic in detail..."
                value={newHeuristicText}
                onChange={(e) => setNewHeuristicText(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          {heuristicError && (
            <p className="text-sm text-red-600">{heuristicError}</p>
          )}

          <Button
            type="button"
            onClick={handleAddHeuristic}
            variant="outline"
            className="self-start"
          >
            Add Heuristic
          </Button>
        </div>
      </div>

      {/* Separator */}
      <Separator className="my-6" />

      {/* Added Heuristics */}
      <div>
        <h3 className="mb-4 text-sm font-semibold">
          {heuristics.length} {heuristics.length === 1 ? "heuristic" : "heuristics"} added
        </h3>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          {heuristics.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No heuristics added yet. Add your first heuristic above.
            </p>
          ) : (
            <div>
              {heuristics.map((heuristic, index) => (
                <div key={heuristic.id}>
                  <DraggableHeuristicItem
                    heuristic={heuristic}
                    index={index}
                    moveHeuristic={moveHeuristic}
                    onRemove={handleRemoveHeuristic}
                  />
                  {index < heuristics.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form error */}
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{formError}</p>
        </div>
      )}

      {/* Submit button */}
      <div className="mt-6 flex">
        <Button
          type="submit"
          disabled={isSubmitting || !name.trim() || heuristics.length === 0}
        >
          Create
        </Button>
      </div>
    </form>
  );
}
