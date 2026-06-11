import { useState, ReactNode } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("EvaluationDetail");
  const tSeverity = useTranslations("Severity");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  const severityKeys: Record<SeverityRating, string> = {
    0: "none",
    1: "cosmetic",
    2: "minor",
    3: "major",
    4: "blocker",
  };

  const severityDescKeys: Record<SeverityRating, string> = {
    0: "descNone",
    1: "descCosmetic",
    2: "descMinor",
    3: "descMajor",
    4: "descBlocker",
  };
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
          <DialogTitle>{t("newIssue")}</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <label className="mb-2 block font-medium">
            {t("whichStepIsIssue")}
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
                    alt={t("stepNumber", { number: selectedImageIndex + 1 })}
                    width={48}
                    height={48}
                    className="rounded border object-contain"
                    priority
                    unoptimized
                  />
                  <span>{t("stepNumber", { number: selectedImageIndex + 1 })}</span>
                </div>
              ) : (
                <span className="text-zinc-500">{t("chooseStep")}</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {presignedUrls.map((url, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  <div className="flex items-center gap-2">
                    <Image
                      src={url}
                      alt={t("stepNumber", { number: idx + 1 })}
                      width={128}
                      height={128}
                      className="rounded border object-contain"
                      priority
                      unoptimized
                    />
                    <span>{t("stepNumber", { number: idx + 1 })}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-4">
          <label className="mb-2 block font-medium">{t("whatIsIssue")}</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("describeIssue")}
            rows={5}
            className="resize-none"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block font-medium">
            {t("howSevereIsIssue")}
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
                  {tSeverity(severityKeys[severity as SeverityRating])}
                </Badge>
              ) : (
                <Button variant="outline" className="justify-start">
                  <span className="text-zinc-500">{t("selectSeverity")}</span>
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
                        <span className="font-medium">{tSeverity(severityKeys[level])}</span>
                        <span className="text-muted-foreground text-xs">
                          {tSeverity(severityDescKeys[level])}
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
          {t("add")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
