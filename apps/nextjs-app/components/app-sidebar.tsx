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
import { getCompanyByMyDomain, getCompanyMembers } from "@/apps/nextjs-app/lib/data";

import { getCurrentUser } from "../lib/user";

// Menu items.
const items = [
  {
    title: "Studies",
    url: "/studies",
    // icon: Home,
  },
];

export async function AppSidebar() {
  const { user } = await getCurrentUser();

  const imageUrl = user.imageKey
    ? await getPresignedUrls(user.imageKey)
    : user.image; // fallback to google image when no uploaded image
  // Extract user properties
  const { id, name, email } = user;

  // Determine organization visibility (server-side) for NavUser
  const domainInfo = await getCompanyByMyDomain();
  // Attempt to get membership role from domain lookup first, then fall back to fetching members
  let membershipRole: string | null = (domainInfo as any)?.membershipRole ?? null;
  if (!membershipRole && domainInfo?.company?.id) {
    try {
      const members = await getCompanyMembers(domainInfo.company.id);
      membershipRole =
        members?.find((m: any) => m.userId === user.id)?.role || null;
    } catch (e) {
      // Silently ignore membership fetch errors for sidebar rendering
      membershipRole = null;
    }
  }
  const navOrgInfo = {
    isConsumer: domainInfo?.isConsumer ?? false,
    hasCompany: !!domainInfo?.company,
    hasDomain: !!domainInfo?.domain,
    domain: domainInfo?.domain || null,
    companyStatus: domainInfo?.company?.status || null,
    requestedByUserId: domainInfo?.requestedByUserId || null,
    membershipRole,
  };

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
              {items.map((item) => (
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
          user={{ id, name, email, image: imageUrl }}
          orgInfo={navOrgInfo}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
