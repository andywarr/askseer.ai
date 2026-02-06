"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinTeam, requestTeamJoin } from "@/apps/nextjs-app/lib/db/data";
import { TeamCard } from "@/apps/nextjs-app/app/(auth)/team/team-card";
import type { Team } from "@/apps/nextjs-app/app/(auth)/team/team-card";

interface Props {
  teams: Team[];
  currentUserId: string;
}

export default function BrowseTeams({ teams, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);

  // Pre-compute membership status for each team once
  const membershipMap = useMemo(() => {
    const map = new Map<string, { isMember: boolean; hasRequested: boolean }>();
    for (const team of teams) {
      let isMember = false;
      let hasRequested = false;
      for (const member of team.members) {
        if (member.userId === currentUserId) {
          if (member.status === "ACTIVE") isMember = true;
          if (member.status === "PENDING") hasRequested = true;
        }
      }
      map.set(team.id, { isMember, hasRequested });
    }
    return map;
  }, [teams, currentUserId]);

  const handleJoinTeam = useCallback(
    (teamId: string) => {
      setJoiningTeamId(teamId);
      startTransition(async () => {
        try {
          await joinTeam(teamId, currentUserId);
          toast.success("Successfully joined team");
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to join team";
          toast.error(message);
        } finally {
          setJoiningTeamId(null);
        }
      });
    },
    [currentUserId, router],
  );

  const handleRequestToJoin = useCallback(
    (teamId: string, note?: string) => {
      setRequestingTeamId(teamId);
      startTransition(async () => {
        try {
          await requestTeamJoin(teamId, currentUserId, note);
          toast.success("Request sent successfully");
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to send request";
          toast.error(message);
        } finally {
          setRequestingTeamId(null);
        }
      });
    },
    [currentUserId, router],
  );

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

      {teams.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No teams available</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const status = membershipMap.get(team.id) ?? {
              isMember: false,
              hasRequested: false,
            };
            return (
              <TeamCard
                key={team.id}
                team={team}
                currentUserId={currentUserId}
                isMember={status.isMember}
                hasRequested={status.hasRequested}
                isPending={pending}
                onJoin={handleJoinTeam}
                onRequestToJoin={handleRequestToJoin}
                isJoining={joiningTeamId === team.id}
                isRequesting={requestingTeamId === team.id}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
