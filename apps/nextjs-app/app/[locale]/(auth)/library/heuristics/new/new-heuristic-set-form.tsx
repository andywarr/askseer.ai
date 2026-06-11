"use client";

import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { newHeuristicSetSchema, getNewHeuristicSetSchema } from "@/apps/nextjs-app/lib/db/schema";
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
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { X, GripVertical } from "lucide-react";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { useDrag, useDrop } from "react-dnd";
import type { Identifier } from "dnd-core";
import { useHeuristicFormSubmit } from "./use-heuristic-form-submit";

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

const DraggableHeuristicItem = React.memo(function DraggableHeuristicItem({
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
});

DraggableHeuristicItem.displayName = "DraggableHeuristicItem";

export function NewHeuristicSetForm({ companyId }: NewHeuristicSetFormProps) {
  const t = useTranslations("Library");
  const { handleSubmit, isSubmitting, formError, setFormError } =
    useHeuristicFormSubmit({ companyId });
  const [heuristicError, setHeuristicError] = useState<string>("");
  const [showHeuristicForm, setShowHeuristicForm] = useState(false);

  // State for building new heuristics (not part of the validated form)
  const [newHeuristicLabel, setNewHeuristicLabel] = useState("");
  const [newHeuristicCategory, setNewHeuristicCategory] = useState("");
  const [newHeuristicText, setNewHeuristicText] = useState("");

  const form = useForm<z.infer<typeof newHeuristicSetSchema>>({
    resolver: zodResolver(getNewHeuristicSetSchema(t)),
    defaultValues: {
      name: "",
      description: "",
      heuristics: [],
    },
    mode: "onChange", // Enable validation on change
  });

  const heuristics = form.watch("heuristics");

  const handleAddHeuristic = useCallback(() => {
    setHeuristicError("");

    if (!newHeuristicLabel.trim() || !newHeuristicText.trim()) {
      setHeuristicError(t("pleaseProvideLabelAndText"));
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
  }, [newHeuristicLabel, newHeuristicCategory, newHeuristicText, heuristics, form]);

  const handleCancelHeuristic = useCallback(() => {
    setNewHeuristicLabel("");
    setNewHeuristicCategory("");
    setNewHeuristicText("");
    setHeuristicError("");
    setShowHeuristicForm(false);
  }, []);

  const handleRemoveHeuristic = useCallback(
    (id: string) => {
      form.setValue(
        "heuristics",
        heuristics.filter((h) => h.id !== id),
        {
          shouldValidate: true,
        },
      );
    },
    [heuristics, form],
  );

  const moveHeuristic = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const updatedHeuristics = [...heuristics];
      const [draggedItem] = updatedHeuristics.splice(dragIndex, 1);
      updatedHeuristics.splice(hoverIndex, 0, draggedItem);
      form.setValue("heuristics", updatedHeuristics);
    },
    [heuristics, form],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="w-full space-y-6"
      >
        {/* Basic Information */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold">{t("information")}</h2>
          <div className="grid grid-cols-1 gap-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("namePlaceholder")}
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
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
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
          <h2 className="mb-4 text-2xl font-semibold">{t("heuristics")}</h2>

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
              {t("noHeuristicsAdded")}
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
              {t("addHeuristicLink")}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-y-4">
                <div>
                  <Label htmlFor="heuristic-label" className="mb-2 block">
                    {t("label")}
                  </Label>
                  <Input
                    id="heuristic-label"
                    placeholder={t("labelPlaceholder")}
                    value={newHeuristicLabel}
                    onChange={(e) => setNewHeuristicLabel(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="heuristic-category" className="mb-2 block">
                    {t("category")}
                  </Label>
                  <Input
                    id="heuristic-category"
                    placeholder={t("categoryPlaceholder")}
                    value={newHeuristicCategory}
                    onChange={(e) => setNewHeuristicCategory(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="heuristic-text" className="mb-2 block">
                    {t("heuristicTextLabel")}
                  </Label>
                  <Textarea
                    id="heuristic-text"
                    placeholder={t("heuristicTextPlaceholder")}
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
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleAddHeuristic}
                  variant="outline"
                >
                  {t("addHeuristicBtn")}
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
            {t("addHeuristicsBtn")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
