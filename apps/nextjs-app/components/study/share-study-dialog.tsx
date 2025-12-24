"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Building2,
  Users,
  Lock,
  RefreshCw,
  Share2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Label } from "@/apps/nextjs-app/components/ui/label";
import { Switch } from "@/apps/nextjs-app/components/ui/switch";
import type { StudyVisibility } from "@/apps/nextjs-app/types/types";

interface ShareStudyDialogProps {
  studyId: string;
  userId: string;
  currentVisibility: StudyVisibility;
  shareToken: string | null;
  teamName?: string | null;
  hasCompany?: boolean;
  isPersonalTeam?: boolean;
  onVisibilityChange: (
    visibility: StudyVisibility,
  ) => Promise<{ success: boolean; shareToken?: string }>;
  onRegenerateToken: () => Promise<{ success: boolean; shareToken?: string }>;
  onToggleShareLink?: (
    enabled: boolean,
  ) => Promise<{ success: boolean; shareToken?: string }>;
  trigger?: React.ReactNode;
  // Controlled mode props
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const VISIBILITY_OPTIONS: {
  value: StudyVisibility;
  label: string;
  description: string;
  icon: typeof Lock;
  requiresCompany?: boolean;
  requiresNonPersonalTeam?: boolean;
}[] = [
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only you can view this study",
    icon: Lock,
  },
  {
    value: "TEAM",
    label: "Team",
    description: "All team members can view",
    icon: Users,
    requiresCompany: true,
    requiresNonPersonalTeam: true,
  },
  {
    value: "COMPANY",
    label: "Company",
    description: "All company members can view",
    icon: Building2,
    requiresCompany: true,
  },
];

export function ShareStudyDialog({
  studyId,
  userId,
  currentVisibility,
  shareToken,
  teamName,
  hasCompany = false,
  isPersonalTeam = false,
  onVisibilityChange,
  onRegenerateToken,
  onToggleShareLink,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ShareStudyDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled mode if props are provided
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;

  // For personal teams, normalize TEAM/COMPANY visibility to PRIVATE
  // since those options aren't available for personal teams
  const normalizedVisibility: StudyVisibility =
    !hasCompany &&
    (currentVisibility === "TEAM" || currentVisibility === "COMPANY")
      ? "PRIVATE"
      : currentVisibility;

  const [visibility, setVisibility] =
    useState<StudyVisibility>(normalizedVisibility);
  const [token, setToken] = useState<string | null>(shareToken);
  const [shareLinkEnabled, setShareLinkEnabled] =
    useState<boolean>(!!shareToken);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTogglingShareLink, setIsTogglingShareLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setVisibility(normalizedVisibility);
      setToken(shareToken);
      setShareLinkEnabled(!!shareToken);
    }
  }, [open, normalizedVisibility, shareToken]);

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${token}`
    : null;

  const handleVisibilityChange = async (newVisibility: StudyVisibility) => {
    if (newVisibility === visibility) return;

    setIsUpdating(true);
    try {
      const result = await onVisibilityChange(newVisibility);
      if (result.success) {
        setVisibility(newVisibility);
        if (result.shareToken) {
          setToken(result.shareToken);
        }
        toast.success("Sharing settings updated");
        router.refresh();
      } else {
        toast.error("Failed to update sharing settings");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update sharing settings",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleShareLink = async (enabled: boolean) => {
    if (!onToggleShareLink) return;

    setIsTogglingShareLink(true);
    try {
      const result = await onToggleShareLink(enabled);
      if (result.success) {
        setShareLinkEnabled(enabled);
        if (enabled && result.shareToken) {
          setToken(result.shareToken);
        } else if (!enabled) {
          setToken(null);
        }
        toast.success(
          enabled ? "Shareable link created" : "Shareable link removed",
        );
        router.refresh();
      } else {
        toast.error("Failed to update share link");
      }
    } catch (error) {
      toast.error("Failed to update share link");
    } finally {
      setIsTogglingShareLink(false);
    }
  };

  const handleRegenerateToken = async () => {
    setIsRegenerating(true);
    try {
      const result = await onRegenerateToken();
      if (result.success && result.shareToken) {
        setToken(result.shareToken);
        toast.success("Share link regenerated");
      } else {
        toast.error("Failed to regenerate share link");
      }
    } catch (error) {
      toast.error("Failed to regenerate share link");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const selectedOption = VISIBILITY_OPTIONS.find((o) => o.value === visibility);
  const SelectedIcon = selectedOption?.icon || Lock;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share study</DialogTitle>
          <DialogDescription>Choose who can view this study</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Visibility selector - only shown for company teams */}
          {hasCompany && (
            <div className="flex flex-col gap-2">
              <Label>Who can access</Label>
              <Select
                value={visibility}
                onValueChange={(value) =>
                  handleVisibilityChange(value as StudyVisibility)
                }
                disabled={isUpdating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <SelectedIcon className="h-4 w-4" />
                      <span>{selectedOption?.label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.filter(
                    (option) =>
                      (!option.requiresCompany || hasCompany) &&
                      (!option.requiresNonPersonalTeam || !isPersonalTeam),
                  ).map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {option.description}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {teamName && visibility === "TEAM" && (
                <p className="text-muted-foreground text-xs">
                  Shared with all members of {teamName}
                </p>
              )}
            </div>
          )}

          {/* Shareable link toggle */}
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-zinc-500" />
                <div className="flex flex-col">
                  <Label htmlFor="share-link-toggle" className="cursor-pointer">
                    Create shareable link
                  </Label>
                  <span className="text-muted-foreground text-xs">
                    Anyone with the link can view
                  </span>
                </div>
              </div>
              <Switch
                id="share-link-toggle"
                checked={shareLinkEnabled}
                onCheckedChange={handleToggleShareLink}
                disabled={isTogglingShareLink}
              />
            </div>

            {/* Share link input and actions */}
            {shareLinkEnabled && shareUrl && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                    aria-label="Copy link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateToken}
                    disabled={isRegenerating}
                    className="text-xs"
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`}
                    />
                    Regenerate link
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
