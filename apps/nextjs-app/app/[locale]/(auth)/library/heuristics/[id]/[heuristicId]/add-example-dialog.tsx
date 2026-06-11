"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { createHeuristicExample } from "@/apps/nextjs-app/lib/actions/heuristic-actions";

interface AddExampleFormProps {
  heuristicId: string;
}

export function AddExampleForm({ heuristicId }: AddExampleFormProps) {
  const t = useTranslations("Library");
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [example, setExample] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!example.trim()) {
      setError(t("pleaseProvideExample"));
      return;
    }

    setIsSubmitting(true);

    try {
      await createHeuristicExample({
        heuristicId,
        title: title.trim() || undefined,
        example: example.trim(),
      });

      // Reset form
      setTitle("");
      setExample("");
      setShowForm(false);

      // Refresh the page to show the new example
      router.refresh();
    } catch (error) {
      console.error("Error adding example:", error);
      setError(
        error instanceof Error
          ? error.message
          : t("failedToAddExample"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setExample("");
    setError("");
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <Button
        type="button"
        onClick={() => setShowForm(true)}
        variant="link"
        className="h-auto p-0"
      >
        {t("addExample")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-y-4">
        <div>
          <Label htmlFor="example-title" className="mb-2 block">
            {t("titleOptional")}
          </Label>
          <Input
            id="example-title"
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="example-text" className="mb-2 block">
            {t("exampleLabel")}
          </Label>
          <Textarea
            id="example-text"
            placeholder={t("examplePlaceholder")}
            rows={4}
            value={example}
            onChange={(e) => setExample(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleCancel}
          variant="secondary"
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          variant="outline"
          disabled={isSubmitting || !example.trim()}
        >
          {t("add")}
        </Button>
      </div>
    </div>
  );
}
