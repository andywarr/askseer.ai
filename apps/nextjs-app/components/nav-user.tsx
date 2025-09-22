"use client";

// Next.js imports
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

// Lib function imports
import {
  signOutServerAction,
  updateSelectedTeamAction,
} from "@/apps/nextjs-app/lib/action";

// Lucide icons imports
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  User,
  Building2,
  Users,
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
} from "@/apps/nextjs-app/components/ui/sidebar";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { cn, getInitials } from "@/apps/nextjs-app/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { createCompanyForMyDomain } from "@/apps/nextjs-app/lib/data";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/apps/nextjs-app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import { toast } from "sonner";

export function NavUser({
  user,
  orgInfo,
  teams = [],
}: {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    selectedTeamId?: string | null;
  };
  orgInfo?: {
    isConsumer: boolean;
    hasCompany: boolean;
    hasDomain?: boolean | null;
    domain?: string | null;
    companyStatus?: string | null;
    requestedByUserId: string | null;
    membershipRole?: string | null; // 'OWNER' | 'ADMIN' | 'MEMBER'
    isTeamAdmin?: boolean;
  };
  teams?: Array<{
    id: string;
    name: string;
    isPersonal: boolean;
    companyId?: string | null;
    companyName?: string | null;
    credits: number;
    role?: string | null;
  }>;
}) {
  const router = useRouter();
  const initials = getInitials(user.name)?.trim();
  const [claimOpen, setClaimOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "pending">("create");
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [claimSubmitting, startClaimTransition] = useTransition();
  const [teamUpdating, startTeamTransition] = useTransition();
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    user.selectedTeamId ?? null,
  );
  useEffect(() => {
    if (user.selectedTeamId) {
      if (teams.some((team) => team.id === user.selectedTeamId)) {
        setActiveTeamId(user.selectedTeamId);
      } else {
        setActiveTeamId(null);
      }
    } else {
      setActiveTeamId(null);
    }
  }, [teams, user.selectedTeamId]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (a.isPersonal === b.isPersonal) {
        return a.name.localeCompare(b.name);
      }
      return a.isPersonal ? -1 : 1;
    });
  }, [teams]);

  const showTeamSelector =
    sortedTeams.length > 0 && sortedTeams.some((team) => !team.isPersonal);

  const activeTeam = useMemo(
    () => sortedTeams.find((team) => team.id === activeTeamId) ?? null,
    [sortedTeams, activeTeamId],
  );

  const formatTeamName = (team: (typeof sortedTeams)[number]) =>
    team.isPersonal ? `${team.name} (Personal)` : team.name;

  const activeTeamLabel = activeTeam ? formatTeamName(activeTeam) : "Select a team";

  const activeTeamCredits =
    activeTeam && typeof activeTeam.credits === "number"
      ? activeTeam.credits
      : null;
  const activeTeamCreditsLabel =
    activeTeamCredits === null
      ? null
      : `${activeTeamCredits} ${activeTeamCredits === 1 ? "credit" : "credits"}`;
  const activeTeamCreditsClass =
    activeTeamCredits === null
      ? ""
      : activeTeamCredits <= 1
        ? "text-red-500"
        : activeTeamCredits >= 2 && activeTeamCredits <= 9
          ? "text-amber-500"
          : "";

  const handleTeamSelect = (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      setTeamPopoverOpen(false);
      return;
    }
    const targetTeam =
      sortedTeams.find((team) => team.id === teamId) ?? null;
    setTeamPopoverOpen(false);
    startTeamTransition(async () => {
      try {
        await updateSelectedTeamAction(teamId);
        setActiveTeamId(teamId);
        if (targetTeam) {
          toast.success(`Switched to ${formatTeamName(targetTeam)}`);
        } else {
          toast.success("Active team updated");
        }
        router.refresh();
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : "Failed to switch team";
        toast.error(message);
      }
    });
  };

  // Show org settings only if there is a company, not consumer, and not rejected.
  // If pending, only the requesting user should see it (with Pending badge).
  const isRejected = orgInfo?.companyStatus === "REJECTED";
  const isPending = orgInfo?.companyStatus === "PENDING";
  const isRequester =
    !!orgInfo?.requestedByUserId && orgInfo.requestedByUserId === user.id;
  // Treat owners and admins (or the claimant while pending) as authorized to view company settings.
  const isOwnerOrAdmin =
    orgInfo?.membershipRole === "OWNER" ||
    orgInfo?.membershipRole === "ADMIN" ||
    (isPending && isRequester);
  const showOrgSettings =
    !!orgInfo?.hasCompany &&
    orgInfo?.isConsumer !== true &&
    !isRejected &&
    isOwnerOrAdmin; // Only owners/admins (or claimant while pending) can see once company exists.
  const showClaimCompany =
    orgInfo?.isConsumer === false &&
    !orgInfo?.hasCompany &&
    (orgInfo?.hasDomain ?? true);

  const showTeams =
    !!orgInfo?.hasCompany &&
    orgInfo?.companyStatus === "ACTIVE" &&
    orgInfo?.isConsumer !== true &&
    (isOwnerOrAdmin || orgInfo?.isTeamAdmin === true);

  const submitClaim = () => {
    if (!authorized) return;
    startClaimTransition(async () => {
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
            <div className="bg-sidebar mt-2 rounded-md border p-2">
              {showTeamSelector && (
                <div className="mb-2">
                  <Popover
                    open={teamPopoverOpen}
                    onOpenChange={setTeamPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        type="button"
                        role="combobox"
                        aria-expanded={teamPopoverOpen}
                        aria-haspopup="listbox"
                        aria-label="Active team"
                        className="h-8 w-full justify-start px-2"
                        disabled={teamUpdating}
                      >
                        <Users className="h-4 w-4" />
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate">
                            {teamUpdating ? "Switching..." : activeTeamLabel}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </span>
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0"
                      align="start"
                      style={{
                        width: "var(--radix-popover-trigger-width)",
                        minWidth: "var(--radix-popover-trigger-width)",
                        maxWidth: "var(--radix-popover-trigger-width)",
                      }}
                    >
                      <Command>
                        <CommandInput placeholder="Search teams..." />
                        <CommandList>
                          <CommandEmpty>No teams found.</CommandEmpty>
                          <CommandGroup>
                            {sortedTeams.map((team) => (
                              <CommandItem
                                key={team.id}
                                value={`${team.name} ${team.isPersonal ? "personal" : ""}`.trim()}
                                onSelect={() => handleTeamSelect(team.id)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    team.id === activeTeamId
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                <span className="truncate">
                                  {formatTeamName(team)}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {activeTeamCreditsLabel && (
                    <p
                      className={cn(
                        "mt-2 px-2 text-xs font-medium",
                        activeTeamCreditsClass,
                      )}
                    >
                      {activeTeamCreditsLabel}
                    </p>
                  )}
                  <Separator className="my-2" />
                </div>
              )}
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
                    onClick={() => {
                      // If user already has company
                      if (showOrgSettings) {
                        if (isPending && isRequester) {
                          // Show pending modal instead of navigation
                          setDialogMode("pending");
                          setClaimOpen(true);
                        } else {
                          window.location.href = "/company";
                        }
                        return;
                      }
                      // Otherwise open create claim modal
                      setDialogMode("create");
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
                {showTeams && (
                  <SidebarMenuButton
                    className="h-8 w-full justify-start px-2"
                    asChild
                  >
                    <Link href="/teams">
                      <Users className="h-4 w-4" />
                      <span>Teams</span>
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
          {dialogMode === "create" && (
            <>
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
                    I am authorized to claim this company and verify ownership
                    of this email domain.
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setClaimOpen(false)}
                    disabled={claimSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitClaim}
                    disabled={!authorized || claimSubmitting}
                  >
                    Claim
                  </Button>
                </div>
              </div>
            </>
          )}
          {dialogMode === "pending" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                  <Building2 className="h-5 w-5" /> Company claim under review
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm leading-6 tracking-tight">
                <p className="leading-7 [&:not(:first-child)]:mt-6">
                  We are verifying your domain ownership. You can continue using
                  Seer while we review.
                </p>
                <p className="leading-7 [&:not(:first-child)]:mt-6">
                  Questions? Contact {""}
                  <a
                    href="mailto:teams@askseer.ai"
                    className="font-medium underline underline-offset-2"
                  >
                    teams@askseer.ai
                  </a>
                  .
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
