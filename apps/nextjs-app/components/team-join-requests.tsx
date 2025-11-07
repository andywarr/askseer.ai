"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import { Button } from "@/apps/nextjs-app/components/ui/button";
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
} from "@/apps/nextjs-app/lib/data";
import { getInitials } from "@/apps/nextjs-app/lib/utils";

interface JoinRequest {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
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

  const handleReject = (userId: string) => {
    setProcessingUserId(userId);
    startTransition(async () => {
      try {
        await rejectTeamJoinRequest(teamId, userId, currentUserId);
        toast.success("Request rejected");
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
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {request.user.image ? (
                    <AvatarImage src={request.user.image} />
                  ) : (
                    <AvatarFallback>
                      {getInitials(request.user.name || request.user.email)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {request.user.name || request.user.email}
                  </span>
                  <span className="text-muted-foreground text-sm">
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAccept(request.userId)}
                  disabled={pending && processingUserId === request.userId}
                >
                  Accept
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
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
