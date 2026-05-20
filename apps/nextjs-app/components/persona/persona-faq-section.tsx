"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Check,
  X,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/apps/nextjs-app/components/ui/accordion";
import { useDrag, useDrop } from "react-dnd";
import DndProviderComponent from "@/apps/nextjs-app/components/dnd-provider";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { EditableField } from "@/apps/nextjs-app/components/ui/editable-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  createPersonaFaqItem,
  updatePersonaFaqItem,
  deletePersonaFaqItem,
  reorderPersonaFaqItems,
  type PersonaFaqItem,
} from "@/apps/nextjs-app/lib/actions/persona-chat-actions";

const FAQ_DND_TYPE = "faq-item";

interface FaqDragItem {
  id: string;
  index: number;
}

interface DraggableFaqItemProps {
  item: PersonaFaqItem;
  index: number;
  canManage: boolean;
  isDragEnabled: boolean;
  inlineQuestionEdit: string | undefined;
  setInlineQuestionEdit: (value: string | undefined) => void;
  savingQuestion: boolean;
  onSaveInlineQuestion: () => void;
  onEditQuestion: () => void;
  onSetDeleteTarget: () => void;
  onSaveInlineAnswer: (newAnswer: string) => void;
  savingInline: boolean;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  onDragEnd: () => void;
}

function DraggableFaqItem({
  item,
  index,
  canManage,
  isDragEnabled,
  inlineQuestionEdit,
  setInlineQuestionEdit,
  savingQuestion,
  onSaveInlineQuestion,
  onEditQuestion,
  onSetDeleteTarget,
  onSaveInlineAnswer,
  savingInline,
  moveItem,
  onDragEnd,
}: DraggableFaqItemProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [handleVisible, setHandleVisible] = useState(false);

  const [, drop] = useDrop<FaqDragItem>({
    accept: FAQ_DND_TYPE,
    hover(draggedItem) {
      if (!wrapperRef.current) return;
      if (draggedItem.index === index) return;
      moveItem(draggedItem.index, index);
      draggedItem.index = index;
    },
  });

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: FAQ_DND_TYPE,
    item: (): FaqDragItem => ({ id: item.id, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: onDragEnd,
  });

  dragPreview(drop(wrapperRef));
  if (isDragEnabled) drag(dragHandleRef);

  return (
    <div
      ref={wrapperRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onMouseLeave={() => setHandleVisible(false)}
    >
      <AccordionItem value={item.id}>
        {inlineQuestionEdit !== undefined ? (
          <AccordionPrimitive.Header className="flex min-h-[52px] items-center">
            <div
              className="flex min-w-0 flex-1 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={inlineQuestionEdit}
                onChange={(e) => setInlineQuestionEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setInlineQuestionEdit(undefined);
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSaveInlineQuestion();
                  }
                }}
                disabled={savingQuestion}
                className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium focus:border-zinc-400 focus:outline-none"
                autoFocus
              />
              <div
                role="button"
                tabIndex={0}
                className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                onClick={onSaveInlineQuestion}
              >
                {savingQuestion ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </div>
              <div
                role="button"
                tabIndex={0}
                className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md"
                onClick={() => setInlineQuestionEdit(undefined)}
              >
                <X className="h-4 w-4" />
              </div>
            </div>
          </AccordionPrimitive.Header>
        ) : (
          <AccordionPrimitive.Header
            className="group/header flex items-center"
            onMouseEnter={() =>
              canManage && isDragEnabled && setHandleVisible(true)
            }
          >
            {canManage && isDragEnabled && (
              <div
                ref={dragHandleRef}
                className={`flex cursor-grab items-center justify-center overflow-hidden py-4 text-zinc-300 transition-[width] duration-150 hover:text-zinc-400 active:cursor-grabbing ${handleVisible ? "w-6" : "w-0"}`}
                aria-label="Drag to reorder"
              >
                <GripVertical className="h-4 w-4 shrink-0" />
              </div>
            )}
            <AccordionPrimitive.Trigger className="flex flex-1 items-center gap-4 py-4 text-left text-sm font-medium transition-all outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950/50 [&[data-state=open]>svg]:rotate-180">
              <span className="flex-1">{item.question}</span>
              {canManage && (
                <div
                  className="pointer-events-none flex items-center gap-1 opacity-0 transition-opacity group-hover/header:pointer-events-auto group-hover/header:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="hover:bg-accent hover:text-accent-foreground inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditQuestion();
                    }}
                    aria-label="Edit FAQ item"
                  >
                    <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDeleteTarget();
                    }}
                    aria-label="Delete FAQ item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                </div>
              )}
              <ChevronDown className="size-4 shrink-0 text-zinc-500 transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
        )}
        <AccordionContent
          className={
            canManage && isDragEnabled
              ? `transition-[padding-left] duration-150${handleVisible ? "pl-6" : ""}`
              : undefined
          }
        >
          <EditableField
            value={item.answer}
            canEdit={canManage}
            onSave={onSaveInlineAnswer}
            isSaving={savingInline}
            multiline
            textClassName="text-sm leading-relaxed text-zinc-600"
          />
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}

interface PersonaFaqSectionProps {
  personaGroupId: string;
  personaStudyId: string;
  canManage: boolean;
  initialItems: PersonaFaqItem[];
}

type DialogMode = "add" | "edit" | null;

export function PersonaFaqSection({
  personaGroupId,
  personaStudyId,
  canManage,
  initialItems,
}: PersonaFaqSectionProps) {
  const [items, setItems] = useState<PersonaFaqItem[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  const [search, setSearch] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingItem, setEditingItem] = useState<PersonaFaqItem | null>(null);
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PersonaFaqItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingInline, setSavingInline] = useState<Record<string, boolean>>({});
  const [inlineQuestionEdits, setInlineQuestionEdits] = useState<
    Record<string, string>
  >({});
  const [savingQuestion, setSavingQuestion] = useState<Record<string, boolean>>(
    {},
  );

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    setItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(hoverIndex, 0, removed);
      return next;
    });
  }, []);

  const persistOrder = useCallback(async () => {
    await reorderPersonaFaqItems(
      personaGroupId,
      itemsRef.current.map((i) => i.id),
      personaStudyId,
    );
  }, [personaGroupId, personaStudyId]);

  const filteredItems = search.trim()
    ? items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const openAdd = useCallback(() => {
    setFormQuestion("");
    setFormAnswer("");
    setEditingItem(null);
    setErrorMessage(null);
    setDialogMode("add");
  }, []);

  const openEdit = useCallback((item: PersonaFaqItem) => {
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
    setEditingItem(item);
    setErrorMessage(null);
    setDialogMode("edit");
  }, []);

  const handleSave = useCallback(() => {
    if (!formQuestion.trim() || !formAnswer.trim()) return;
    setErrorMessage(null);

    startTransition(async () => {
      if (dialogMode === "add") {
        const result = await createPersonaFaqItem(
          personaGroupId,
          formQuestion.trim(),
          formAnswer.trim(),
          personaStudyId,
        );
        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }
        setItems((prev) => [...prev, result.data]);
      } else if (dialogMode === "edit" && editingItem) {
        const result = await updatePersonaFaqItem(
          editingItem.id,
          formQuestion.trim(),
          formAnswer.trim(),
          personaStudyId,
        );
        if (!result.success) {
          setErrorMessage(result.error);
          return;
        }
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? result.data : i)),
        );
      }
      setDialogMode(null);
    });
  }, [
    dialogMode,
    editingItem,
    formQuestion,
    formAnswer,
    personaGroupId,
    personaStudyId,
  ]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await deletePersonaFaqItem(
        deleteTarget.id,
        personaStudyId,
      );
      if (!result.success) {
        setErrorMessage(result.error);
        setDeleteTarget(null);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }, [deleteTarget, personaStudyId]);

  const handleSaveInlineAnswer = useCallback(
    async (item: PersonaFaqItem, newAnswer: string) => {
      if (!newAnswer.trim() || newAnswer.trim() === item.answer) return;
      setSavingInline((prev) => ({ ...prev, [item.id]: true }));
      const result = await updatePersonaFaqItem(
        item.id,
        item.question,
        newAnswer.trim(),
        personaStudyId,
      );
      setSavingInline((prev) => ({ ...prev, [item.id]: false }));
      if (result.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? result.data : i)),
        );
      }
    },
    [personaStudyId],
  );

  const handleEditQuestion = useCallback((item: PersonaFaqItem) => {
    setInlineQuestionEdits((prev) => ({ ...prev, [item.id]: item.question }));
  }, []);

  const handleSaveInlineQuestion = useCallback(
    async (item: PersonaFaqItem) => {
      const newQuestion = inlineQuestionEdits[item.id];
      if (newQuestion === undefined) return;
      if (newQuestion.trim() === item.question || !newQuestion.trim()) {
        setInlineQuestionEdits((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        return;
      }
      setSavingQuestion((prev) => ({ ...prev, [item.id]: true }));
      const result = await updatePersonaFaqItem(
        item.id,
        newQuestion.trim(),
        item.answer,
        personaStudyId,
      );
      setSavingQuestion((prev) => ({ ...prev, [item.id]: false }));
      if (result.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? result.data : i)),
        );
        setInlineQuestionEdits((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }
    },
    [inlineQuestionEdits, personaStudyId],
  );

  if (items.length === 0 && !canManage) return null;

  return (
    <section
      className="pb-12 pl-0 md:pl-48"
      aria-labelledby="persona-faq-heading"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="persona-faq-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Frequently asked questions
        </h2>
        {canManage && (
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add FAQ
          </Button>
        )}
      </div>

      {items.length > 3 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search FAQs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
            aria-label="Search FAQ items"
          />
        </div>
      )}

      {filteredItems.length === 0 && items.length > 0 ? (
        <p className="text-sm text-zinc-500">No FAQs match your search.</p>
      ) : filteredItems.length === 0 && canManage ? (
        <p className="text-sm text-zinc-500">
          No FAQ items yet. Add some to help others learn about this persona.
        </p>
      ) : (
        <DndProviderComponent>
          <Accordion type="multiple" className="w-full">
            {filteredItems.map((item, index) => (
              <DraggableFaqItem
                key={item.id}
                item={item}
                index={index}
                canManage={canManage}
                isDragEnabled={canManage && !search.trim()}
                inlineQuestionEdit={inlineQuestionEdits[item.id]}
                setInlineQuestionEdit={(val) => {
                  if (val === undefined) {
                    setInlineQuestionEdits((prev) => {
                      const next = { ...prev };
                      delete next[item.id];
                      return next;
                    });
                  } else {
                    setInlineQuestionEdits((prev) => ({
                      ...prev,
                      [item.id]: val,
                    }));
                  }
                }}
                savingQuestion={savingQuestion[item.id] ?? false}
                onSaveInlineQuestion={() => handleSaveInlineQuestion(item)}
                onEditQuestion={() => handleEditQuestion(item)}
                onSetDeleteTarget={() => setDeleteTarget(item)}
                onSaveInlineAnswer={(newAnswer) =>
                  handleSaveInlineAnswer(item, newAnswer)
                }
                savingInline={savingInline[item.id] ?? false}
                moveItem={moveItem}
                onDragEnd={persistOrder}
              />
            ))}
          </Accordion>
        </DndProviderComponent>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && setDialogMode(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Add FAQ item" : "Edit FAQ item"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Question
              </label>
              <Textarea
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                placeholder="e.g. What frustrates you most about this product?"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Answer
              </label>
              <Textarea
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                rows={5}
                className="resize-none text-sm"
                placeholder="Enter the answer…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formQuestion.trim() || !formAnswer.trim() || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FAQ item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            This will permanently remove this FAQ item. This cannot be undone.
          </p>
          {errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
