"use client";

import { memo, useState, useCallback } from "react";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Users } from "lucide-react";

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status?: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  joinPolicy: TeamJoinPolicy;
  isPersonal: boolean;
  isDefaultForCompany: boolean;
  credits: number;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

interface TeamCardProps {
  team: Team;
  currentUserId: string;
  isMember: boolean;
  hasRequested: boolean;
  isPending: boolean;
  onJoin: (teamId: string) => void;
  onRequestToJoin: (teamId: string, note?: string) => void;
  isJoining: boolean;
  isRequesting: boolean;
}

function getCharCounterColor(length: number, maxLength: number) {
  const remaining = maxLength - length;
  if (remaining <= 10) return "text-red-500";
  if (remaining <= 50) return "text-orange-500";
  return "text-muted-foreground";
}

export const TeamCard = memo(function TeamCard({
  team,
  isMember,
  hasRequested,
  isPending,
  onJoin,
  onRequestToJoin,
  isJoining,
  isRequesting,
}: TeamCardProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [requestNote, setRequestNote] = useState("");

  const showJoinButton =
    team.joinPolicy === "SELF_JOIN" && !isMember && !hasRequested;
  const showRequestButton =
    team.joinPolicy === "REQUEST_TO_JOIN" && !isMember && !hasRequested;
  const showInviteOnly =
    team.joinPolicy === "INVITE_ONLY" && !isMember && !hasRequested;

  const handleShowNoteInput = useCallback(() => {
    setShowNoteInput(true);
    setRequestNote("");
  }, []);

  const handleCancelNote = useCallback(() => {
    setShowNoteInput(false);
    setRequestNote("");
  }, []);

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRequestNote(e.target.value.slice(0, 250));
    },
    [],
  );

  const handleSubmitRequest = useCallback(() => {
    onRequestToJoin(team.id, requestNote || undefined);
    setShowNoteInput(false);
    setRequestNote("");
  }, [onRequestToJoin, team.id, requestNote]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="line-clamp-2 text-xl font-semibold tracking-tight">
            {team.name}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">
              {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </div>
        {team.description && (
          <CardDescription className="mt-2">{team.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter className="min-h-[52px] flex-col items-stretch gap-3">
        {isMember && (
          <Badge variant="secondary" className="mr-auto">
            Member
          </Badge>
        )}
        {hasRequested && (
          <Badge
            variant="outline"
            className="mr-auto border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100"
          >
            Requested
          </Badge>
        )}
        {showInviteOnly && (
          <Badge variant="outline" className="mr-auto">
            Invite only
          </Badge>
        )}
        {showJoinButton && (
          <Button
            variant="outline"
            onClick={() => onJoin(team.id)}
            disabled={isPending}
          >
            {isJoining ? "Joining…" : "Join"}
          </Button>
        )}
        {showRequestButton && !showNoteInput && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onRequestToJoin(team.id)}
              disabled={isPending}
            >
              {isRequesting ? "Requesting…" : "Request to join"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleShowNoteInput}
              disabled={isPending}
            >
              Request with note
            </Button>
          </div>
        )}
        {showRequestButton && showNoteInput && (
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Add a message (optional, max 250 characters)"
              value={requestNote}
              onChange={handleNoteChange}
              maxLength={250}
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${getCharCounterColor(requestNote.length, 250)}`}
              >
                {requestNote.length}/250
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelNote}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSubmitRequest}
                  disabled={isPending}
                >
                  {isRequesting ? "Requesting…" : "Request"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
});
