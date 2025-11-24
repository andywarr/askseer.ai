import Image from "next/image";
import Link from "next/link";

import { NavUser } from "@/apps/nextjs-app/components/nav-user";

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
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import {
  getCompanyByMyDomain,
  getCompanyTeams,
  getUserCompanyRole,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";

import { getCurrentUser } from "../lib/user";

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
  {
    title: "Teams",
    url: "/team",
    // icon: Users,
  },
];

export async function AppSidebar() {
  const { user } = await getCurrentUser();

  const imageUrl = user.imageKey
    ? await getPresignedUrls(user.imageKey)
    : user.image; // fallback to google image when no uploaded image
  // Extract user properties
  const { id, name, email, selectedTeamId } = user;

  // Determine organization visibility (server-side) for NavUser
  const domainInfo = await getCompanyByMyDomain();
  // Attempt to get membership role if company exists
  let membershipRole: string | null = null;
  let isTeamAdmin = false;
  if (domainInfo?.company?.id) {
    try {
      const teams = await getCompanyTeams(domainInfo.company.id);
      membershipRole = await getUserCompanyRole(user.id, domainInfo.company.id);
      isTeamAdmin = teams.some(
        (team: any) =>
          !team.isPersonal &&
          (team.members || []).some(
            (member: any) =>
              member.userId === user.id &&
              String(member.role || "").toUpperCase() === "ADMIN",
          ),
      );
    } catch (e) {
      // Silently ignore membership fetch errors for sidebar rendering
      membershipRole = null;
      isTeamAdmin = false;
    }
  }

  let userTeams: Array<{
    id: string;
    name: string;
    isPersonal: boolean;
    companyId: string | null;
    companyName: string | null;
    companyPersonalTeamsDisabled: boolean;
    credits: number;
    role: string;
  }> = [];

  try {
    userTeams = await getUserTeams(user.id);
  } catch (error) {
    userTeams = [];
  }

  // Determine if credits should be shown
  // Show credits if:
  // 1. User has no company (consumer), OR
  // 2. User is a company admin/owner, OR
  // 3. User is a team admin/owner, OR
  // 4. User is part of a company but personal teams are NOT disabled
  let showCredits = true;
  if (domainInfo.company && membershipRole) {
    const isCompanyAdmin =
      membershipRole === "ADMIN" || membershipRole === "OWNER";

    // Check if personal teams are disabled for this company
    const personalTeamsDisabled = userTeams.some(
      (team) =>
        team.companyId === domainInfo.company?.id &&
        team.companyPersonalTeamsDisabled,
    );

    console.log("Credits visibility check:", {
      hasCompany: !!domainInfo.company,
      membershipRole,
      isCompanyAdmin,
      isTeamAdmin,
      personalTeamsDisabled,
      userTeams: userTeams.map((t) => ({
        name: t.name,
        companyId: t.companyId,
        companyPersonalTeamsDisabled: t.companyPersonalTeamsDisabled,
      })),
    });

    // Hide credits if user is not a company admin, not a team admin, and personal teams are disabled
    if (!isCompanyAdmin && !isTeamAdmin && personalTeamsDisabled) {
      showCredits = false;
      console.log(
        "Credits hidden: user is not admin and personal teams disabled",
      );
    }
  }

  console.log("Final showCredits value:", showCredits);

  const navOrgInfo = {
    isConsumer: !!domainInfo.isConsumer,
    hasCompany: !!domainInfo.company,
    hasDomain: !!domainInfo.domain,
    domain: domainInfo.domain || null,
    companyStatus: domainInfo.company?.status || null,
    requestedByUserId: domainInfo.requestedByUserId || null,
    membershipRole,
    isTeamAdmin,
    showCredits,
  };

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
        <div className="flex items-center gap-2 p-2">
          <Image
            alt="logo"
            className="h-8 w-8"
            src="/logo.svg"
            width={32}
            height={32}
          />
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-black md:text-5xl">
            Seer
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Button className="flex w-max items-center gap-2" asChild>
            <Link href="/new">
              New Study
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 5v14M5 12h14"
                />
              </svg>
            </Link>
          </Button>
        </SidebarGroup>
        <SidebarSeparator className="mx-2 !w-[calc(100%-1rem)]" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="font-medium">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      {/* <item.icon /> */}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{ id, name, email, image: imageUrl, selectedTeamId }}
          orgInfo={navOrgInfo}
          teams={userTeams}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
