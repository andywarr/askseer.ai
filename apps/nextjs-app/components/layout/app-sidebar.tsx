import Image from "next/image";

import { NavUser } from "@/apps/nextjs-app/components/layout/nav-user";
import { SidebarNavLink } from "@/apps/nextjs-app/components/layout/sidebar-nav-link";
import { SidebarTeamSwitcherWrapper } from "@/apps/nextjs-app/components/layout/sidebar-team-switcher-wrapper";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/apps/nextjs-app/components/ui/sidebar";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import {
  getCompanyByMyDomain,
  getCompanyTeams,
  getUserCompanyRole,
  getUserTeams,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";

import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";

import { Plus } from "lucide-react";

// Menu items.
const items = [
  {
    title: "Studies",
    url: "/studies",
    // icon: Home,
  },
  {
    title: "Library",
    url: "/library",
    // icon: Library,
  },
];

export async function AppSidebar() {
  const { user } = await getCurrentUser();

  // Parallelize independent async operations
  const [imageUrl, domainInfoResult, userTeamsResult] = await Promise.all([
    getUserImageUrl(user),
    getCompanyByMyDomain().catch((error) => {
      logger.error("Failed to fetch company domain info for sidebar", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isConsumer: true,
        company: null,
        domain: null,
      } as Awaited<ReturnType<typeof getCompanyByMyDomain>>;
    }),
    getUserTeams(user.id).catch((error) => {
      logger.error("Failed to fetch user teams for sidebar", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as Array<{
        id: string;
        name: string;
        isPersonal: boolean;
        companyId: string | null;
        companyName: string | null;
        companyPersonalTeamsDisabled: boolean;
        balanceCents: number;
        role: string;
        isDefaultForCompany: boolean;
      }>;
    }),
  ]);

  const domainInfo = domainInfoResult;
  const userTeams = userTeamsResult;

  // Extract user properties
  const { id, name, email, selectedTeamId } = user;

  // Attempt to get membership role if company exists
  let membershipRole: string | null = null;
  let isTeamAdmin = false;
  if (domainInfo?.company?.id) {
    try {
      const [teams, role] = await Promise.all([
        getCompanyTeams(domainInfo.company.id),
        getUserCompanyRole(user.id, domainInfo.company.id),
      ]);
      membershipRole = role;
      isTeamAdmin = teams.some(
        (team: any) =>
          !team.isPersonal &&
          (team.members || []).some(
            (member: any) =>
              member.userId === user.id &&
              String(member.role || "").toUpperCase() === "ADMIN",
          ),
      );
    } catch (error) {
      logger.warn("Failed to fetch company membership info for sidebar", {
        userId: user.id,
        companyId: domainInfo.company.id,
        error: error instanceof Error ? error.message : String(error),
      });
      membershipRole = null;
      isTeamAdmin = false;
    }
  }

  // Determine if credits should be shown
  // Show credits if:
  // 1. User has no company (consumer), OR
  // 2. User is a company admin/owner, OR
  // 3. User is a team admin/owner, OR
  // 4. User is part of a company but personal teams are NOT disabled
  const isCompanyAdmin =
    membershipRole === "ADMIN" || membershipRole === "OWNER";

  let showCredits = true;
  if (domainInfo.company && membershipRole) {
    // Check if personal teams are disabled for this company
    const personalTeamsDisabled = userTeams.some(
      (team) =>
        team.companyId === domainInfo.company?.id &&
        team.companyPersonalTeamsDisabled,
    );

    // Hide credits if user is not a company admin, not a team admin, and personal teams are disabled
    if (!isCompanyAdmin && !isTeamAdmin && personalTeamsDisabled) {
      showCredits = false;
    }
  }

  // Determine org settings visibility
  const isRejected = domainInfo.company?.status === "REJECTED";
  const isPending = domainInfo.company?.status === "PENDING";
  const isRequester =
    !!domainInfo.requestedByUserId && domainInfo.requestedByUserId === user.id;
  const isOwnerOrAdmin =
    membershipRole === "OWNER" ||
    membershipRole === "ADMIN" ||
    (isPending && isRequester);

  const showOrgSettings =
    !!domainInfo.company &&
    domainInfo.isConsumer !== true &&
    !isRejected &&
    isOwnerOrAdmin;

  const showClaimCompany =
    domainInfo.isConsumer === false &&
    !domainInfo.company &&
    !!domainInfo.domain;

  const showTeamsLink =
    !!domainInfo.company &&
    domainInfo.company.status === "ACTIVE" &&
    domainInfo.isConsumer !== true &&
    (isOwnerOrAdmin || isTeamAdmin);

  const showJoinTeam =
    !!domainInfo.company &&
    domainInfo.company.status === "ACTIVE" &&
    domainInfo.isConsumer !== true &&
    !!membershipRole;

  // Filter menu items based on user's company membership
  const visibleItems = items.filter((item) => {
    // Only show Teams and Library if user is an active member of a company
    if (item.title === "Teams" || item.title === "Library") {
      return !!domainInfo.company && !!membershipRole;
    }
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarTeamSwitcherWrapper
          teams={userTeams}
          selectedTeamId={selectedTeamId ?? null}
          showOrgSettings={showOrgSettings}
          showClaimCompany={showClaimCompany}
          showTeams={showTeamsLink}
          showJoinTeam={showJoinTeam}
          showCredits={showCredits}
          isCompanyAdmin={isCompanyAdmin}
          isPending={
            !!domainInfo.company && domainInfo.company.status === "PENDING"
          }
          isRequester={
            !!domainInfo.requestedByUserId &&
            domainInfo.requestedByUserId === user.id
          }
          domain={domainInfo.domain}
        />
        <SidebarSeparator className="!w-[calc(100%-1rem)]" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Button className="mx-2 flex w-fit items-center" asChild>
            <SidebarNavLink href="/new">
              <Plus className="size-4 shrink-0" />
              New
            </SidebarNavLink>
          </Button>
        </SidebarGroup>
        <SidebarSeparator className="mx-2 !w-[calc(100%-1rem)]" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="font-medium">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <SidebarNavLink href={item.url}>
                      {/* <item.icon /> */}
                      <span>{item.title}</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ id, name, email, image: imageUrl }} />
      </SidebarFooter>
    </Sidebar>
  );
}
