"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newHeuristicSetSchema } from "@/apps/nextjs-app/lib/db/schema";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/apps/nextjs-app/components/ui/form";
import {
  createHeuristicFamily,
  createHeuristic,
} from "@/apps/nextjs-app/lib/actions/heuristic-actions";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { X, GripVertical } from "lucide-react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [heuristicError, setHeuristicError] = useState<string>("");
  const [showHeuristicForm, setShowHeuristicForm] = useState(false);

  // State for building new heuristics (not part of the validated form)
  const [newHeuristicLabel, setNewHeuristicLabel] = useState("");
  const [newHeuristicCategory, setNewHeuristicCategory] = useState("");
  const [newHeuristicText, setNewHeuristicText] = useState("");

  const form = useForm<z.infer<typeof newHeuristicSetSchema>>({
    resolver: zodResolver(newHeuristicSetSchema),
    defaultValues: {
      name: "",
      description: "",
      heuristics: [],
    },
    mode: "onChange", // Enable validation on change
  });

  const heuristics = form.watch("heuristics");

  // Auto-generate key from name
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

    form.setValue("heuristics", [...heuristics, newHeuristic], {
      shouldValidate: true,
    });
    setNewHeuristicLabel("");
    setNewHeuristicCategory("");
    setNewHeuristicText("");
    setShowHeuristicForm(false);
  };

  const handleCancelHeuristic = () => {
    setNewHeuristicLabel("");
    setNewHeuristicCategory("");
    setNewHeuristicText("");
    setHeuristicError("");
    setShowHeuristicForm(false);
  };

  const handleRemoveHeuristic = (id: string) => {
    form.setValue(
      "heuristics",
      heuristics.filter((h) => h.id !== id),
      {
        shouldValidate: true,
      },
    );
  };

  const moveHeuristic = (dragIndex: number, hoverIndex: number) => {
    const updatedHeuristics = [...heuristics];
    const [draggedItem] = updatedHeuristics.splice(dragIndex, 1);
    updatedHeuristics.splice(hoverIndex, 0, draggedItem);
    form.setValue("heuristics", updatedHeuristics);
  };

  const handleSubmit = async (data: z.infer<typeof newHeuristicSetSchema>) => {
    setFormError("");

    setIsSubmitting(true);

    try {
      // Generate key from name
      const generatedKey = generateKey(data.name);

      // First create the heuristic family using server action
      const familyData = await createHeuristicFamily({
        name: data.name,
        key: generatedKey,
        description: data.description || undefined,
        companyId,
      });

      if (!familyData.success || !familyData.data) {
        throw new Error(
          (!familyData.success && familyData.error) ||
            "Failed to add heuristics",
        );
      }

      const familyId = familyData.data.id;

      // Then create each heuristic using server action
      for (const heuristic of data.heuristics) {
        try {
          await createHeuristic({
            heuristicFamilyId: familyId,
            label: heuristic.label,
            category: heuristic.category,
            heuristic: heuristic.heuristic,
            companyId,
          });
        } catch (heuristicError) {
          console.error(`Failed to add heuristic`, heuristicError);
          // Continue with other heuristics even if one fails
        }
      }

      toast.success("Heuristics added successfully");
      router.push("/library");
      router.refresh();
    } catch (error) {
      console.error("Error adding heuristics:", error);
      setFormError(
        error instanceof Error ? error.message : "Failed to add heuristics",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="w-full space-y-6"
      >
        {/* Basic Information */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Information</h2>
          <div className="grid grid-cols-1 gap-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What is the name of these heuristics? E.g., Nielsen's 10 Usability Heuristics"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="How would you describe these heurisics? E.g., General principles for interaction design best practices."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Separator */}
        <Separator className="my-6" />

        {/* Heuristics Section */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Heuristics</h2>

          {/* Added Heuristics List */}
          {heuristics.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border p-4">
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
          ) : (
            <p className="mb-4 text-sm text-zinc-500">
              No heuristics added yet.
            </p>
          )}

          {/* Add Heuristic Button or Form */}
          {!showHeuristicForm ? (
            <Button
              type="button"
              onClick={() => setShowHeuristicForm(true)}
              variant="link"
              className="h-auto p-0"
            >
              Add heuristic
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <Label htmlFor="heuristic-label" className="mb-2 block">
                    Label
                  </Label>
                  <Input
                    id="heuristic-label"
                    placeholder="What is the short-form label for the heuristic? E.g., Visibility of system status"
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
                    placeholder="What category does this heuristic belong to? E.g., Usability"
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
                    placeholder="What is the heuristic? E.g., The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time"
                    rows={4}
                    value={newHeuristicText}
                    onChange={(e) => setNewHeuristicText(e.target.value)}
                  />
                </div>
              </div>

              {heuristicError && (
                <p className="text-sm text-red-600">{heuristicError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCancelHeuristic}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddHeuristic}
                  variant="outline"
                >
                  Add heuristic
                </Button>
              </div>
            </div>
          )}
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
            disabled={isSubmitting || !form.formState.isValid}
          >
            Add heuristics
          </Button>
        </div>
      </form>
    </Form>
  );
}
