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

  // Extract user properties
  const { name, email, image } = user;

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
        <SidebarSeparator />
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
        <NavUser user={{ name, email, image }} />
      </SidebarFooter>
    </Sidebar>
  );
}
