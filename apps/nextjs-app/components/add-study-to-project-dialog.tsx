"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import { StudyStatus, StudyType } from "@prisma/client";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

interface Study {
  id: string;
  name: string | null;
  type: StudyType;
  status: StudyStatus;
  createdAt: string;
}

interface AddStudyToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (studyId: string) => Promise<void>;
  availableStudies: Study[];
  triggerButton?: React.ReactNode;
}

export function AddStudyToProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  availableStudies,
  triggerButton,
}: AddStudyToProjectDialogProps) {
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudyId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedStudyId);
      setSelectedStudyId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setSelectedStudyId(null);
    }
  };

  const getStudyTypeLabel = (type: StudyType) => {
    switch (type) {
      case StudyType.HEURISTIC_EVALUATION:
        return "Evaluation";
      case StudyType.COGNITIVE_WALKTHROUGH:
        return "Walkthrough";
      case StudyType.PERSONA:
        return "Persona";
      default:
        return type;
    }
  };

  const renderStudyLabel = (study: Study) => {
    return study.name?.trim() || "Untitled";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Study to Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableStudies.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                No available studies to add. All studies in this team have
                already been added to this project.
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Study</label>
                <Select
                  value={selectedStudyId || ""}
                  onValueChange={setSelectedStudyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a study..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStudies.map((study) => (
                      <SelectItem key={study.id} value={study.id}>
                        <div className="flex items-center gap-2">
                          <span>{renderStudyLabel(study)}</span>
                          <Badge variant="outline" className="text-xs">
                            {getStudyTypeLabel(study.type)}
                          </Badge>
                          <Badge
                            variant={
                              study.status === StudyStatus.COMPLETED
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {study.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
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
              disabled={
                isSubmitting ||
                !selectedStudyId ||
                availableStudies.length === 0
              }
            >
              {isSubmitting ? "Adding..." : "Add Study"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
