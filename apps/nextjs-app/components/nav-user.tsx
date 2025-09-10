"use client";

// Next.js imports
import Link from "next/link";

// Lib function imports
import { signOutServerAction } from "@/apps/nextjs-app/lib/action";

// Lucide icons imports
import {
  CreditCard,
  ChevronDown,
  LogOut,
  Bell,
  User,
  Building2,
  AlertCircle,
} from "lucide-react";

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
  orgInfo,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  orgInfo?: {
    isConsumer: boolean;
    hasCompany: boolean;
    hasDomain?: boolean | null;
    companyStatus?: string | null;
    requestedByUserId: string;
  };
}) {
  const { isMobile } = useSidebar();
  const initials = getInitials(user.name)?.trim();
  // Show org settings only if there is a company, not consumer, and not rejected.
  // If pending, only the requesting user should see it (with Pending badge).
  const isRejected = orgInfo?.companyStatus === "REJECTED";
  const isPending = orgInfo?.companyStatus === "PENDING";
  const isRequester =
    !!orgInfo?.requestedByUserId && orgInfo.requestedByUserId === user.id;
  const showOrgSettings =
    !!orgInfo?.hasCompany &&
    orgInfo?.isConsumer !== true &&
    !isRejected &&
    (!isPending || (isPending && isRequester));
  const showClaimCompany =
    orgInfo?.isConsumer === false &&
    !orgInfo?.hasCompany &&
    (orgInfo?.hasDomain ?? true);

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
              <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <div className="bg-sidebar mt-2 space-y-1 rounded-md border p-2">
              <div className="space-y-1">
                <SidebarMenuButton className="cursor-default" asChild>
                  <Link href="/account">
                    <User className="h-4 w-4" />
                    <span>Account</span>
                  </Link>
                </SidebarMenuButton>
                {showOrgSettings && (
                  <SidebarMenuButton
                    className="h-8 w-full justify-start px-2"
                    asChild
                  >
                    <Link href="/company" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="flex items-center gap-1">
                        <span>Company</span>
                        {isPending && isRequester && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                )}
                {showClaimCompany && (
                  <SidebarMenuButton
                    className="h-8 w-full justify-start px-2"
                    asChild
                  >
                    <Link href="/company">
                      <Building2 className="h-4 w-4" />
                      <span>Company</span>
                      <span className="inline-flex items-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white dark:bg-blue-600">
                        Claim
                      </span>
                    </Link>
                  </SidebarMenuButton>
                )}
                {/* <SidebarMenuButton
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
                </SidebarMenuButton> */}
              </div>

              <Separator className="my-2" />

              <form action={signOutServerAction} className="w-full">
                <SidebarMenuButton
                  className="h-8 w-full justify-start px-2"
                  size="sm"
                  type="submit"
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
