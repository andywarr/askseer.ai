"use client";

import { useTranslations, useLocale } from "next-intl";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronsUpDown,
  User,
  UserPlus,
  UsersRound,
  Coins,
} from "lucide-react";

import { updateSelectedTeamAction } from "@/apps/nextjs-app/lib/actions/team-actions";
import {
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
} from "@/apps/shared/constants";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/apps/nextjs-app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/apps/nextjs-app/components/ui/command";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/apps/nextjs-app/components/ui/sidebar";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { useTeamBalance } from "./team-balance-context";

export interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  companyId?: string | null;
  companyName?: string | null;
  balanceCents: number;
  role?: string | null;
  isDefaultForCompany?: boolean;
}

interface SidebarTeamSwitcherProps {
  teams: Team[];
  selectedTeamId: string | null;
  showOrgSettings?: boolean;
  showClaimCompany?: boolean;
  showTeams?: boolean;
  showJoinTeam?: boolean;
  showCredits?: boolean;
  isCompanyAdmin?: boolean;
  isPending?: boolean;
  isRequester?: boolean;
  onClaimClick?: () => void;
  onPendingClick?: () => void;
}


function getTeamIcon(team: Team) {
  if (team.isPersonal) {
    return User;
  }
  if (team.isDefaultForCompany) {
    return Building2;
  }
  return UsersRound;
}

export function SidebarTeamSwitcher({
  teams,
  selectedTeamId,
  showOrgSettings,
  showClaimCompany,
  showTeams,
  showJoinTeam,
  showCredits,
  isCompanyAdmin,
  isPending,
  isRequester,
  onClaimClick,
  onPendingClick,
}: SidebarTeamSwitcherProps) {
  const t = useTranslations("TeamSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const [teamUpdating, startTeamTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const { balanceDelta } = useTeamBalance();
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    selectedTeamId ?? null,
  );

  const formatTeamName = (team: Team): string => {
    if (team.isPersonal) {
      return t("personalTeam", { name: team.name });
    }
    return team.name;
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      if (teams.some((team) => team.id === selectedTeamId)) {
        setActiveTeamId(selectedTeamId);
      } else {
        setActiveTeamId(null);
      }
    } else {
      setActiveTeamId(null);
    }
  }, [teams, selectedTeamId]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;
      if (a.isDefaultForCompany && !b.isDefaultForCompany) return -1;
      if (!a.isDefaultForCompany && b.isDefaultForCompany) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [teams]);

  // Group teams by type
  const personalTeams = sortedTeams.filter((t) => t.isPersonal);
  const defaultCompanyTeam = sortedTeams.find(
    (t) => !t.isPersonal && t.isDefaultForCompany,
  );
  const otherCompanyTeams = sortedTeams.filter(
    (t) => !t.isPersonal && !t.isDefaultForCompany,
  );

  const activeTeam = useMemo(
    () => sortedTeams.find((team) => team.id === activeTeamId) ?? null,
    [sortedTeams, activeTeamId],
  );

  const activeTeamBalance =
    activeTeam && typeof activeTeam.balanceCents === "number"
      ? activeTeam.balanceCents + balanceDelta
      : null;

  const activeCanViewBalance = activeTeam
    ? isCompanyAdmin ||
      activeTeam.isPersonal ||
      activeTeam.role === "ADMIN" ||
      activeTeam.role === "OWNER"
    : false;

  let activeTeamBalanceLabel: string | null = null;
  let activeTeamBalanceClass = "";

  if (activeTeamBalance !== null) {
    if (activeCanViewBalance) {
      activeTeamBalanceLabel = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
      }).format(activeTeamBalance / 100);
    } else {
      // For non-admins, hide exact balance but show low/no funds warnings
      const studyCost = activeTeam?.companyId
        ? COMPANY_MIN_STUDY_COST_CENTS
        : PERSONAL_MIN_STUDY_COST_CENTS;

      if (activeTeamBalance < studyCost) {
        activeTeamBalanceLabel = t("noFunds");
      } else if (activeTeamBalance < studyCost * 3) {
        activeTeamBalanceLabel = t("lowFunds");
      }
    }

    const studyCost = activeTeam?.companyId
      ? COMPANY_MIN_STUDY_COST_CENTS
      : PERSONAL_MIN_STUDY_COST_CENTS;

    if (activeTeamBalance < studyCost) {
      activeTeamBalanceClass = "text-red-500";
    } else if (activeTeamBalance < studyCost * 3) {
      activeTeamBalanceClass = "text-amber-500";
    } else {
      activeTeamBalanceClass = "text-muted-foreground";
    }
  }

  const handleTeamSelect = (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      setOpen(false);
      return;
    }
    const targetTeam = sortedTeams.find((team) => team.id === teamId) ?? null;
    setOpen(false);
    closeMobileSidebar();
    startTeamTransition(async () => {
      try {
        const result = await updateSelectedTeamAction(teamId);
        if (!result.success) {
          throw new Error(result.error);
        }
        setActiveTeamId(teamId);
        if (targetTeam) {
          toast.success(t("switchedToTeam", { name: formatTeamName(targetTeam) }));
        } else {
          toast.success(t("activeTeamUpdated"));
        }
        // Detect if current path is a study details page (persona, evaluation, walkthrough)
        const studyDetailRegex = /^\/(persona|evaluation|walkthrough)\/[^/]+/;
        if (studyDetailRegex.test(pathname)) {
          router.push(locale === "en" ? "/studies" : `/${locale}/studies`);
          return;
        }
        // Force a full page refresh by navigating to the current path
        // This ensures the Router Cache is invalidated and fresh data is fetched
        // Preserve existing search params (e.g. ?teamId for teams page selection)
        const query = searchParams.toString();
        const target = query ? `${pathname}?${query}` : pathname;
        router.push(target);
        router.refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : t("failedToSwitchTeam");
        toast.error(message);
      }
    });
  };

  // Don't show team switcher if no teams
  if (teams.length === 0) {
    return null;
  }

  const ActiveIcon = activeTeam ? getTeamIcon(activeTeam) : UsersRound;

  // Check if we should show the settings section
  const showSettings =
    showOrgSettings || showClaimCompany || showTeams || (showCredits ?? true);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={teamUpdating}
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <ActiveIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {teamUpdating
                    ? t("switching")
                    : activeTeam
                      ? formatTeamName(activeTeam)
                      : t("selectTeam")}
                </span>
                {activeTeamBalanceLabel && (
                  <span
                    className={cn("truncate text-xs", activeTeamBalanceClass)}
                  >
                    {activeTeamBalanceLabel}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder={t("searchPlaceholder")} />
              <CommandList>
                <CommandEmpty>{t("noTeamFound")}</CommandEmpty>
                {/* Personal Teams */}
                {personalTeams.length > 0 && (
                  <CommandGroup heading={t("personalHeading")}>
                    {personalTeams.map((team) => {
                      const Icon = getTeamIcon(team);
                      return (
                        <CommandItem
                          key={team.id}
                          value={`${team.name} personal`}
                          onSelect={() => handleTeamSelect(team.id)}
                          className="gap-2"
                        >
                          <div className="flex size-6 items-center justify-center rounded-sm border">
                            <Icon className="size-4 shrink-0" />
                          </div>
                          <span className="flex-1 truncate">
                            {formatTeamName(team)}
                          </span>
                          {team.id === activeTeamId && (
                            <Check className="size-4 shrink-0" />
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* Other Company Teams */}
                {otherCompanyTeams.length > 0 && (
                  <CommandGroup heading={t("teamsHeading")}>
                    {otherCompanyTeams.map((team) => {
                      const Icon = getTeamIcon(team);
                      return (
                        <CommandItem
                          key={team.id}
                          value={team.name}
                          onSelect={() => handleTeamSelect(team.id)}
                          className="gap-2"
                        >
                          <div className="flex size-6 items-center justify-center rounded-sm border">
                            <Icon className="size-4 shrink-0" />
                          </div>
                          <span className="flex-1 truncate">{team.name}</span>
                          {team.id === activeTeamId && (
                            <Check className="size-4 shrink-0" />
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* Default Company Team */}
                {defaultCompanyTeam && (
                  <CommandGroup heading={t("companyHeading")}>
                    <CommandItem
                      value={defaultCompanyTeam.name}
                      onSelect={() => handleTeamSelect(defaultCompanyTeam.id)}
                      className="gap-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Building2 className="size-4 shrink-0" />
                      </div>
                      <span className="flex-1 truncate">
                        {defaultCompanyTeam.name}
                      </span>
                      {defaultCompanyTeam.id === activeTeamId && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>

              {/* Settings Section - Outside CommandList to stay fixed */}
              {showSettings && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("settingsHeading")}>
                    {(showCredits ?? true) && (
                      <CommandItem
                        value="credits"
                        onSelect={() => {
                          setOpen(false);
                          closeMobileSidebar();
                          window.location.href = locale === "en" ? "/funds" : `/${locale}/funds`;
                        }}
                        className="gap-2"
                      >
                        <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                          <Coins className="size-4 shrink-0" />
                        </div>
                        <span>{t("funds")}</span>
                      </CommandItem>
                    )}
                    {(showOrgSettings || showClaimCompany) && (
                      <CommandItem
                        value="company"
                        onSelect={() => {
                          setOpen(false);
                          if (showOrgSettings) {
                            if (isPending && isRequester && onPendingClick) {
                              onPendingClick();
                            } else {
                              closeMobileSidebar();
                              window.location.href = "/company";
                            }
                            return;
                          }
                          if (onClaimClick) {
                            onClaimClick();
                          }
                        }}
                        className="gap-2"
                      >
                        <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                          <Building2 className="size-4 shrink-0" />
                        </div>
                        <span className="flex items-center gap-1">
                          <span>{t("company")}</span>
                          {showClaimCompany && (
                            <span className="inline-flex items-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white dark:bg-blue-600">
                              {t("claimBadge")}
                            </span>
                          )}
                          {isPending && isRequester && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none font-medium text-amber-700">
                              {t("pendingBadge")}
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    )}
                    {showTeams && (
                      <CommandItem
                        value="teams manage"
                        onSelect={() => {
                          setOpen(false);
                          closeMobileSidebar();
                          window.location.href = locale === "en" ? "/teams" : `/${locale}/teams`;
                        }}
                        className="gap-2"
                      >
                        <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                          <UsersRound className="size-4 shrink-0" />
                        </div>
                        <span>{t("teams")}</span>
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}

              {showJoinTeam && (
                <>
                  <CommandSeparator />
                  <CommandItem
                    value="join teams"
                    onSelect={() => {
                      setOpen(false);
                      closeMobileSidebar();
                      window.location.href = locale === "en" ? "/team" : `/${locale}/team`;
                    }}
                    className="mx-1 gap-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                      <UserPlus className="size-4 shrink-0" />
                    </div>
                    <span>{t("joinTeam")}</span>
                  </CommandItem>
                </>
              )}
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
