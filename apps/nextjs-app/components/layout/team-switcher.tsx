"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { updateSelectedTeamAction } from "@/apps/nextjs-app/lib/actions/team-actions";

interface TeamSwitcherProps {
  currentTeamId: string | null;
  userTeams: Array<{ id: string; name: string; isPersonal: boolean }>;
  children: React.ReactNode;
}

export function TeamSwitcher({
  currentTeamId,
  userTeams,
  children,
}: TeamSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const switchingRef = useRef(false);

  useEffect(() => {
    const teamIdParam = searchParams.get("teamId");

    // Only switch if:
    // 1. There's a teamId in the URL
    // 2. It's different from the current team
    // 3. We're not already in the process of switching
    if (teamIdParam && teamIdParam !== currentTeamId && !switchingRef.current) {
      switchingRef.current = true;

      const targetTeam = userTeams.find((team) => team.id === teamIdParam);

      updateSelectedTeamAction(teamIdParam)
        .then(() => {
          // Remove teamId from URL after successful switch
          const params = new URLSearchParams(searchParams.toString());
          params.delete("teamId");
          const query = params.toString();
          const target = query ? `${pathname}?${query}` : pathname;

          // Refresh the page to get new data with the switched team
          router.replace(target);
          router.refresh();

          // Format team name like in nav-user
          if (targetTeam) {
            const teamLabel = targetTeam.isPersonal
              ? `${targetTeam.name} (Personal)`
              : targetTeam.name;
            toast.success(`Switched to ${teamLabel}`);
          } else {
            toast.success("Active team updated");
          }
        })
        .catch((error) => {
          switchingRef.current = false;
          const message =
            error instanceof Error ? error.message : "Failed to switch team";
          toast.error(message);

          // Remove invalid teamId from URL
          const params = new URLSearchParams(searchParams.toString());
          params.delete("teamId");
          const query = params.toString();
          const target = query ? `${pathname}?${query}` : pathname;
          router.replace(target, { scroll: false });
        });
    }
  }, [searchParams, currentTeamId, pathname, router, userTeams]);

  return <>{children}</>;
}
