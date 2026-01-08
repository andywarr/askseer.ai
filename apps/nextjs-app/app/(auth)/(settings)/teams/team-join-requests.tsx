"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  acceptTeamJoinRequest,
  rejectTeamJoinRequest,
} from "@/apps/nextjs-app/lib/db/data";
import { getInitials } from "@/apps/nextjs-app/lib/utils/utils";

interface JoinRequest {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  requestNote?: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string;
  };
}

interface Props {
  teamId: string;
  teamName: string;
  requests: JoinRequest[];
  currentUserId: string;
  onRequestProcessed?: () => void | Promise<void>;
}

export default function TeamJoinRequests({
  teamId,
  teamName,
  requests,
  currentUserId,
  onRequestProcessed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [showRejectNoteForUserId, setShowRejectNoteForUserId] = useState<
    string | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleAccept = (userId: string) => {
    setProcessingUserId(userId);
    startTransition(async () => {
      try {
        await acceptTeamJoinRequest(teamId, userId, currentUserId);
        toast.success("Request accepted");
        // Refetch the join requests first to update the list
        if (onRequestProcessed) {
          await onRequestProcessed();
        }
        // Then refresh the page to update team members
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "Failed to accept request");
      } finally {
        setProcessingUserId(null);
      }
    });
  };

  const handleReject = (userId: string, reason?: string) => {
    setProcessingUserId(userId);
    startTransition(async () => {
      try {
        await rejectTeamJoinRequest(teamId, userId, currentUserId, reason);
        toast.success("Request rejected");
        setShowRejectNoteForUserId(null);
        setRejectReason("");
        // Refetch the join requests first to update the list
        if (onRequestProcessed) {
          await onRequestProcessed();
        }
        // Then refresh the page
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "Failed to reject request");
      } finally {
        setProcessingUserId(null);
      }
    });
  };

  const handleShowRejectNote = (userId: string) => {
    setShowRejectNoteForUserId(userId);
    setRejectReason("");
  };

  const handleCancelRejectNote = () => {
    setShowRejectNoteForUserId(null);
    setRejectReason("");
  };

  const getCharCounterColor = (length: number, maxLength: number) => {
    const remaining = maxLength - length;
    if (remaining <= 10) return "text-red-500";
    if (remaining <= 50) return "text-orange-500";
    return "text-muted-foreground";
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Pending Join Requests</CardTitle>
        <CardDescription>
          {requests.length}{" "}
          {requests.length === 1 ? "person has" : "people have"} requested to
          join {teamName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3 md:min-w-0 md:flex-shrink">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={request.user.image || undefined} />
                  <AvatarFallback>
                    {getInitials(request.user.name || request.user.email) ||
                      "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {request.user.name || request.user.email}
                  </span>
                  <span className="text-muted-foreground truncate text-sm">
                    {request.user.email}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Requested{" "}
                    {new Date(request.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {request.requestNote && (
                <>
                  <div className="border-t md:h-auto md:self-stretch md:border-t-0 md:border-l" />
                  <div className="bg-muted/50 px-3 py-2 text-sm italic md:flex-1">
                    {request.requestNote}
                  </div>
                  <div className="border-t md:h-auto md:self-stretch md:border-t-0 md:border-l" />
                </>
              )}
              {showRejectNoteForUserId !== request.userId ? (
                <div className="flex items-center gap-2 md:flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleShowRejectNote(request.userId)}
                    disabled={pending}
                  >
                    Reject with note
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleReject(request.userId)}
                    disabled={pending && processingUserId === request.userId}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(request.userId)}
                    disabled={pending && processingUserId === request.userId}
                  >
                    Accept
                  </Button>
                </div>
              ) : (
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-shrink-0">
                  <Textarea
                    placeholder="Add a reason for rejection (optional, max 250 characters)"
                    value={rejectReason}
                    onChange={(e) =>
                      setRejectReason(e.target.value.slice(0, 250))
                    }
                    maxLength={250}
                    rows={3}
                    className="w-full resize-none md:w-80"
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${getCharCounterColor(rejectReason.length, 250)}`}
                    >
                      {rejectReason.length}/250
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelRejectNote}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          handleReject(
                            request.userId,
                            rejectReason || undefined,
                          )
                        }
                        disabled={
                          pending && processingUserId === request.userId
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
