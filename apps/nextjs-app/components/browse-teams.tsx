"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TeamJoinPolicy } from "@/apps/nextjs-app/types/types";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
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

  const handleRequestToJoin = (teamId: string) => {
    setRequestingTeamId(teamId);
    startTransition(async () => {
      try {
        await requestTeamJoin(teamId, currentUserId);
        toast.success("Request sent successfully");
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "Failed to send request");
      } finally {
        setRequestingTeamId(null);
      }
    });
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

  return (
    <section>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          Team
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse and join teams in your company
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No teams available</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
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
                <CardFooter className="min-h-[52px]">
                  {isMember && (
                    <Badge variant="secondary" className="mr-auto">
                      Member
                    </Badge>
                  )}
                  {showRequestedBadge && (
                    <Badge variant="outline" className="mr-auto">
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
                  {showRequestButton && (
                    <Button
                      variant="outline"
                      onClick={() => handleRequestToJoin(team.id)}
                      disabled={pending && isRequesting}
                    >
                      Request to join
                    </Button>
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
