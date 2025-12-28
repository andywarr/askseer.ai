"use client";

import { useState } from "react";

import { SidebarTeamSwitcher, type Team } from "./sidebar-team-switcher";
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
  showCredits?: boolean;
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
  showCredits,
  isPending,
  isRequester,
  domain,
}: SidebarTeamSwitcherWrapperProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ClaimCompanyDialogMode>("create");

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
        showCredits={showCredits}
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
