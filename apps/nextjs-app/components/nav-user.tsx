"use client";

import { SignOut } from "@/apps/nextjs-app/components/sign-out";

import { CreditCard, ChevronDown, LogOut, Bell, User } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/apps/nextjs-app/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/apps/nextjs-app/components/ui/sidebar";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    image: string;
  };
}) {
  const { isMobile } = useSidebar();

  // Generate initials from the user's name
  const getFallback = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {getFallback(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <div className="bg-sidebar mt-2 space-y-1 rounded-md border p-2">
              {/* <div className="space-y-1">
                <SidebarMenuButton
                  className="h-8 w-full justify-start px-2"
                  size="sm"
                >
                  <User className="h-4 w-4" />
                  <span>Account</span>
                </SidebarMenuButton>
                <SidebarMenuButton
                  className="h-8 w-full justify-start px-2"
                  size="sm"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing</span>
                </SidebarMenuButton>
                <SidebarMenuButton
                  className="h-8 w-full justify-start px-2"
                  size="sm"
                >
                  <Bell className="h-4 w-4" />
                  <span>Notifications</span>
                </SidebarMenuButton>
              </div>

              <Separator className="my-2" /> */}

              <SidebarMenuButton
                className="h-8 w-full justify-start px-2"
                size="sm"
              >
                <LogOut className="h-4 w-4" />
                <SignOut />
              </SidebarMenuButton>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
