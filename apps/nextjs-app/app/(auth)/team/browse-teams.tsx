"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { joinTeam, requestTeamJoin } from "@/apps/nextjs-app/lib/data";

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Team {
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

interface Props {
  teams: Team[];
  currentUserId: string;
  companyId: string;
}

export default function BrowseTeams({
  teams,
  currentUserId,
  companyId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [showNoteInputForTeam, setShowNoteInputForTeam] = useState<
    string | null
  >(null);
  const [requestNote, setRequestNote] = useState("");

  const handleJoinTeam = (teamId: string) => {
    setJoiningTeamId(teamId);
    startTransition(async () => {
      try {
        await joinTeam(teamId, currentUserId);
        toast.success("Successfully joined team");
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "Failed to join team");
      } finally {
        setJoiningTeamId(null);
      }
    });
  };

  const handleRequestToJoin = (teamId: string, note?: string) => {
    setRequestingTeamId(teamId);
    startTransition(async () => {
      try {
        await requestTeamJoin(teamId, currentUserId, note);
        toast.success("Request sent successfully");
        setShowNoteInputForTeam(null);
        setRequestNote("");
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "Failed to send request");
      } finally {
        setRequestingTeamId(null);
      }
    });
  };

  const handleShowNoteInput = (teamId: string) => {
    setShowNoteInputForTeam(teamId);
    setRequestNote("");
  };

  const handleCancelNote = () => {
    setShowNoteInputForTeam(null);
    setRequestNote("");
  };

  const isUserMember = (team: Team) => {
    return team.members.some(
      (member) => member.userId === currentUserId && member.status === "ACTIVE",
    );
  };

  const hasUserRequested = (team: Team) => {
    return team.members.some(
      (member) =>
        member.userId === currentUserId && member.status === "PENDING",
    );
  };

  const canJoin = (team: Team) => {
    return (
      team.joinPolicy === "SELF_JOIN" &&
      !isUserMember(team) &&
      !hasUserRequested(team)
    );
  };

  const canRequestToJoin = (team: Team) => {
    return (
      team.joinPolicy === "REQUEST_TO_JOIN" &&
      !isUserMember(team) &&
      !hasUserRequested(team)
    );
  };

  const hasRequested = (team: Team) => {
    return hasUserRequested(team);
  };

  const isInviteOnly = (team: Team) => {
    return team.joinPolicy === "INVITE_ONLY";
  };

  const isSecretTeam = (team: Team) => {
    return team.joinPolicy === "SECRET";
  };

  const visibleTeams = teams.filter(
    (team) => !isSecretTeam(team) || isUserMember(team),
  );

  const getCharCounterColor = (length: number, maxLength: number) => {
    const remaining = maxLength - length;
    if (remaining <= 10) return "text-red-500";
    if (remaining <= 50) return "text-orange-500";
    return "text-muted-foreground";
  };

  return (
    <section>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          Teams
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse and join teams in your company
        </p>
      </div>

      {visibleTeams.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No teams available</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleTeams.map((team) => {
            const isMember = isUserMember(team);
            const showJoinButton = canJoin(team);
            const showRequestButton = canRequestToJoin(team);
            const showRequestedBadge = hasRequested(team);
            const showInviteOnly =
              isInviteOnly(team) && !isMember && !showRequestedBadge;
            const isJoining = joiningTeamId === team.id;
            const isRequesting = requestingTeamId === team.id;

            return (
              <Card key={team.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="line-clamp-2 text-xl font-semibold tracking-tight">
                      {team.name}
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">
                        {team.memberCount}{" "}
                        {team.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>
                  {team.description && (
                    <CardDescription className="mt-2">
                      {team.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1"></CardContent>
                <CardFooter className="min-h-[52px] flex-col items-stretch gap-3">
                  {isMember && (
                    <Badge variant="secondary" className="mr-auto">
                      Member
                    </Badge>
                  )}
                  {showRequestedBadge && (
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
                      onClick={() => handleJoinTeam(team.id)}
                      disabled={pending && isJoining}
                    >
                      Join
                    </Button>
                  )}
                  {showRequestButton && showNoteInputForTeam !== team.id && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRequestToJoin(team.id)}
                        disabled={pending && isRequesting}
                      >
                        Request to join
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleShowNoteInput(team.id)}
                        disabled={pending}
                      >
                        Request with note
                      </Button>
                    </div>
                  )}
                  {showRequestButton && showNoteInputForTeam === team.id && (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        placeholder="Add a message (optional, max 250 characters)"
                        value={requestNote}
                        onChange={(e) =>
                          setRequestNote(e.target.value.slice(0, 250))
                        }
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
                            disabled={pending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleRequestToJoin(
                                team.id,
                                requestNote || undefined,
                              )
                            }
                            disabled={pending && isRequesting}
                          >
                            Request
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
