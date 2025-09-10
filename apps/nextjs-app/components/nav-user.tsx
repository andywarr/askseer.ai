"use client";

// Next.js imports
import Link from "next/link";
import { useState, useTransition } from "react";

// Lib function imports
import { signOutServerAction } from "@/apps/nextjs-app/lib/action";

// Lucide icons imports
import { ChevronDown, LogOut, User, Building2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { createCompanyForMyDomain } from "@/apps/nextjs-app/lib/data";
import { toast } from "sonner";

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
    domain?: string | null;
    companyStatus?: string | null;
    requestedByUserId: string;
  };
}) {
  const { isMobile } = useSidebar();
  const initials = getInitials(user.name)?.trim();
  const [claimOpen, setClaimOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, startTransition] = useTransition();
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

  const submitClaim = () => {
    if (!authorized) return;
    startTransition(async () => {
      try {
        const res = await createCompanyForMyDomain(
          companyName.trim() || undefined,
        );
        if ((res as any)?.success) {
          toast.success("Company claim submitted");
          setClaimOpen(false);
        } else {
          toast.error("Failed to submit claim");
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to submit claim");
      }
    });
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
                {(showOrgSettings || showClaimCompany) && (
                  <SidebarMenuButton
                    className="h-8 w-full justify-start px-2"
                    size="sm"
                    onClick={() => {
                      // If already has company just open read-only info by navigating.
                      if (showOrgSettings) {
                        window.location.href = "/company";
                        return;
                      }
                      setClaimOpen(true);
                    }}
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="flex items-center gap-1">
                      <span>Company</span>
                      {showClaimCompany && (
                        <span className="inline-flex items-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white dark:bg-blue-600">
                          Claim
                        </span>
                      )}
                      {isPending && isRequester && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </span>
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
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Building2 className="h-5 w-5" /> Claim your company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="claim-company-name"
                className="leading-7 tracking-tight text-zinc-500"
              >
                What is your company&apos;s name?
              </label>
              <Input
                id="claim-company-name"
                placeholder="e.g. Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-10"
              />
              {orgInfo?.domain && (
                <p className="mt-1 text-xs text-zinc-500">
                  We&apos;ll associate {orgInfo.domain} with this company.
                </p>
              )}
            </div>
            <div className="my-4 flex items-start gap-2">
              <input
                id="claim-auth"
                type="checkbox"
                className="peer mt-1 h-4 w-4 rounded border border-zinc-300 text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
              <label
                htmlFor="claim-auth"
                className="text-xs leading-5 text-zinc-600 peer-disabled:cursor-not-allowed"
              >
                I am authorized to claim this company and verify ownership of
                this email domain.
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setClaimOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={submitClaim}
                disabled={!authorized || submitting}
              >
                Claim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
