"use client";

// Next.js imports
import Link from "next/link";

// Lib function imports
import { signOutServerAction } from "@/apps/nextjs-app/lib/actions/auth-actions";

// Lucide icons imports
import { ChevronsUpDown, LogOut, User } from "lucide-react";

// Component imports
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
import { getInitials } from "@/apps/nextjs-app/lib/utils";

export function NavUser({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}) {
  const { setOpenMobile, isMobile } = useSidebar();
  const initials = getInitials(user.name)?.trim();

  // Helper to close the mobile sidebar
  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
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
                <AvatarImage
                  src={user.image || undefined}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback className="rounded-lg">
                  {initials ? (
                    initials
                  ) : (
                    <User className="h-4 w-4" aria-label="User" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <div className="bg-sidebar mt-2 rounded-md border p-2">
              <div className="space-y-1">
                <SidebarMenuButton className="cursor-default" asChild>
                  <Link href="/account" onClick={closeMobileSidebar}>
                    <User className="h-4 w-4" />
                    <span>Account</span>
                  </Link>
                </SidebarMenuButton>
              </div>

              <Separator className="my-2" />

              <form action={signOutServerAction} className="w-full">
                <SidebarMenuButton
                  className="h-8 w-full justify-start px-2"
                  type="submit"
                  onClick={closeMobileSidebar}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </form>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
