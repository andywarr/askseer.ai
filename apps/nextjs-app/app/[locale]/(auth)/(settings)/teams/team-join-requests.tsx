"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/apps/nextjs-app/components/ui/card";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { toast } from "sonner";
import {
  acceptTeamJoinRequest,
  rejectTeamJoinRequest,
} from "@/apps/nextjs-app/lib/db/data";
import type { JoinRequest } from "./types";

interface TeamJoinRequestsProps {
  teamId: string;
  teamName: string;
  requests: JoinRequest[];
  currentUserId?: string;
  onRequestProcessed?: () => void;
}

export default function TeamJoinRequests({
  teamId,
  teamName,
  requests,
  currentUserId,
  onRequestProcessed,
}: TeamJoinRequestsProps) {
  const router = useRouter();
  const t = useTranslations("TeamsSettings");
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) {
    return null;
  }

  const handleAccept = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request || !currentUserId) return;

    startTransition(async () => {
      try {
        await acceptTeamJoinRequest(teamId, request.userId, currentUserId);
        toast.success(t("requestAccepted"));
        onRequestProcessed?.();
        router.refresh();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : t("failedToAcceptRequest")
        );
      }
    });
  };

  const handleReject = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request || !currentUserId) return;

    startTransition(async () => {
      try {
        await rejectTeamJoinRequest(
          teamId,
          request.userId,
          currentUserId,
          rejectReason.trim() || undefined
        );
        toast.success(t("requestRejected"));
        setRejectingRequestId(null);
        setRejectReason("");
        onRequestProcessed?.();
        router.refresh();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : t("failedToRejectRequest")
        );
      }
    });
  };

  return (
    <Card className="mt-6 border-amber-200 dark:border-amber-900/50">
      <CardHeader>
        <CardTitle>{t("pendingJoinRequestsTitle")}</CardTitle>
        <CardDescription>
          {t("pendingJoinRequestsDesc", { count: requests.length, teamName })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => {
            const isRejectionInputOpen = rejectingRequestId === request.id;

            return (
              <div
                key={request.id}
                className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {request.user.name || request.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("requestedAt", {
                      date: new Date(request.joinedAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      ),
                    })}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:w-auto">
                  {isRejectionInputOpen ? (
                    <div className="flex flex-col gap-2 sm:min-w-[300px]">
                      <Textarea
                        placeholder={t("rejectReasonPlaceholder")}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        maxLength={250}
                        rows={2}
                        disabled={pending}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectingRequestId(null);
                            setRejectReason("");
                          }}
                          disabled={pending}
                        >
                          {t("cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(request.id)}
                          disabled={pending}
                        >
                          {t("rejectWithNoteBtn")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectingRequestId(request.id)}
                        disabled={pending}
                      >
                        {t("rejectBtn")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request.id)}
                        disabled={pending}
                      >
                        {t("acceptBtn")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
