"use client";

import { useState, useEffect } from "react";

import { SidebarTeamSwitcher, type Team } from "./sidebar-team-switcher";
import { useTeamBalance } from "./team-balance-context";
import {
  ClaimCompanyDialog,
  type ClaimCompanyDialogMode,
} from "./claim-company-dialog";

interface SidebarTeamSwitcherWrapperProps {
  teams: Team[];
  selectedTeamId: string | null;
  showOrgSettings?: boolean;
  showClaimCompany?: boolean;
  showTeams?: boolean;
  showJoinTeam?: boolean;
  showCredits?: boolean;
  isCompanyAdmin?: boolean;
  isPending?: boolean;
  isRequester?: boolean;
  domain?: string | null;
}

export function SidebarTeamSwitcherWrapper({
  teams,
  selectedTeamId,
  showOrgSettings,
  showClaimCompany,
  showTeams,
  showJoinTeam,
  showCredits,
  isCompanyAdmin,
  isPending,
  isRequester,
  domain,
}: SidebarTeamSwitcherWrapperProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [dialogMode, setDialogMode] =
    useState<ClaimCompanyDialogMode>("create");
  const { resetDelta } = useTeamBalance();

  // When Next.js re-renders the server component and provides fresh team data,
  // clear any locally accumulated balance delta so the sidebar shows the DB truth.
  useEffect(() => {
    resetDelta();
  }, [teams, resetDelta]);

  const handleClaimClick = () => {
    setDialogMode("create");
    setClaimOpen(true);
  };

  const handlePendingClick = () => {
    setDialogMode("pending");
    setClaimOpen(true);
  };

  return (
    <>
      <SidebarTeamSwitcher
        teams={teams}
        selectedTeamId={selectedTeamId}
        showOrgSettings={showOrgSettings}
        showClaimCompany={showClaimCompany}
        showTeams={showTeams}
        showJoinTeam={showJoinTeam}
        showCredits={showCredits}
        isCompanyAdmin={isCompanyAdmin}
        isPending={isPending}
        isRequester={isRequester}
        onClaimClick={handleClaimClick}
        onPendingClick={handlePendingClick}
      />
      <ClaimCompanyDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        mode={dialogMode}
        domain={domain}
      />
    </>
  );
}
