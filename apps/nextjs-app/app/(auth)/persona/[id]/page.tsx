// Next imports
import { redirect } from "next/navigation";

// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import {
  getPersona,
  getPersonaVersions,
  isUserTeamAdmin,
  getTeam,
  getStarredStudyIds,
} from "@/apps/nextjs-app/lib/data";
import { getPresignedUrls as getPresignedUrl } from "@/apps/nextjs-app/lib/action";
import Image from "next/image";
import { PersonaMoreMenu } from "@/apps/nextjs-app/components/persona-more-menu";
import { StarStudyButton } from "@/apps/nextjs-app/components/star-study-button";
import { StudyCard } from "@/apps/nextjs-app/components/study-card";
import { PersonaVersionCard } from "@/apps/nextjs-app/components/persona-version-card";
import { PersonaRelatedStudies } from "@/apps/nextjs-app/components/persona-related-studies";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/user-metadata";
import {
  Calendar,
  User as UserIcon,
  VenusAndMars as GenderIcon,
  MapPin,
  GraduationCap,
  Banknote,
  Heart,
  Users,
  Brain,
  Sparkles,
  Gem,
  Target,
  AlertTriangle,
  Cpu,
  Smartphone,
  MessageSquare,
  Zap,
  Wrench,
  Building2,
  Factory,
  Briefcase,
  Network,
  ShieldCheck,
  Wallet,
  DollarSign,
  ListChecks,
  Quote,
} from "lucide-react";
import type { Persona } from "@/apps/shared/jobSchema";
import { StudyStatus, StudyType } from "@prisma/client";

// Logger import
import { logger } from "@/apps/shared/logger";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const [study, starredStudyIds] = await Promise.all([
    getPersona(id, session.userId),
    getStarredStudyIds(session.userId),
  ]);

  const isStarred = starredStudyIds.includes(id);

  if (!study || !study.persona) {
    logger.warn("Persona not found", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      personaExists: !!study?.persona,
    });
    redirect("/error");
  }

  logger.debug("Persona retrieved successfully", {
    userId: study.createdByUserId,
    studyId: study.id,
    fileCount: study.files.length,
  });

  const isOwner = session.userId === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(session.userId, study.teamId)
    : false;
  const canManageStudy = isOwner || isTeamAdmin;

  const persona: Persona | undefined =
    (study?.persona.data.data as Persona | undefined) || undefined;

  if (!persona) {
    throw new Error("Persona not found");
  }

  const name = persona?.name || undefined;

  const coverKey: string | undefined = persona.images?.coverKey || undefined;
  const photoKey: string | undefined = persona.images?.photoKey || undefined;

  let coverUrl: string | null = null;
  if (coverKey) {
    try {
      coverUrl = await getPresignedUrl(coverKey);
    } catch (e) {
      coverUrl = null;
    }
  }

  let photoUrl: string | null = null;
  if (photoKey) {
    try {
      photoUrl = await getPresignedUrl(photoKey);
    } catch (e) {
      photoUrl = null;
    }
  }

  type AssociatedStudy = {
    id: string;
    name: string | null;
    type: StudyType;
    status: StudyStatus;
    createdByUserId: string;
    files?: Array<{ key?: string | null } | null> | null;
    createdAt?: string | Date | null;
    updatedAt?: string | Date | null;
  };

  const associatedStudiesRaw: AssociatedStudy[] = [
    ...((study.persona?.heuristicEvaluations || [])
      .map((entry: { study?: AssociatedStudy | null }) => entry?.study)
      .filter(Boolean) as AssociatedStudy[]),
    ...((study.persona?.cognitiveWalkthroughs || [])
      .map((entry: { study?: AssociatedStudy | null }) => entry?.study)
      .filter(Boolean) as AssociatedStudy[]),
  ];

  // Create a map of study ID to persona version
  const studyToPersonaVersionMap = new Map<string, number>();
  [
    ...(study.persona?.heuristicEvaluations || []),
    ...(study.persona?.cognitiveWalkthroughs || []),
  ].forEach((entry: any) => {
    if (entry?.study?.id && entry?.persona?.version) {
      studyToPersonaVersionMap.set(entry.study.id, entry.persona.version);
    }
  });

  const associatedStudies = Array.from(
    new Map(associatedStudiesRaw.map((item) => [item.id, item])).values(),
  ).sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  const hasAssociatedStudies = associatedStudies.length > 0;

  // Get the current persona version
  const currentPersonaVersion = study.persona?.version ?? 1;

  // Get team credits for edit mode
  let credits = 0;
  if (study.teamId) {
    try {
      const team = await getTeam(study.teamId);
      credits = team?.credits ?? 0;
    } catch (error) {
      logger.warn("Failed to fetch team credits for persona edit", {
        userId: session.userId,
        studyId: study.id,
        teamId: study.teamId,
      });
    }
  }

  // Fetch persona versions if there's a personaGroupId
  let personaVersions: any[] = [];
  const personaGroupId = study.persona?.personaGroupId;
  if (personaGroupId) {
    try {
      personaVersions = await getPersonaVersions(
        personaGroupId,
        session.userId,
      );
      logger.debug("Persona versions retrieved successfully", {
        userId: session.userId,
        personaGroupId,
        versionCount: personaVersions.length,
      });
    } catch (error) {
      logger.warn("Failed to fetch persona versions", {
        userId: session.userId,
        personaGroupId,
        error,
      });
    }
  }

  // Get presigned URLs for version photos
  const versionPhotoMap = new Map<string, string | null>();
  await Promise.all(
    personaVersions.map(async (version) => {
      const photoKey = version.photoFile?.key;
      if (!photoKey) {
        versionPhotoMap.set(version.id, null);
        return;
      }
      try {
        const url = await getPresignedUrl(photoKey);
        versionPhotoMap.set(version.id, url);
      } catch (error) {
        versionPhotoMap.set(version.id, null);
      }
    }),
  );

  const associatedStudyPreviewMap = new Map<string, string | null>();
  await Promise.all(
    associatedStudies.map(async (associatedStudy) => {
      const firstFileKey = associatedStudy?.files?.[0]?.key || undefined;
      if (!firstFileKey) {
        associatedStudyPreviewMap.set(associatedStudy.id, null);
        return;
      }
      try {
        const url = await getPresignedUrl(firstFileKey);
        associatedStudyPreviewMap.set(associatedStudy.id, url);
      } catch (error) {
        associatedStudyPreviewMap.set(associatedStudy.id, null);
      }
    }),
  );

  // Reusable avatar overlay (half over cover, half below)
  const avatarOverlay = (
    <div className="pointer-events-none absolute top-full left-6 z-10 -translate-y-1/2 md:left-8">
      <div className="pointer-events-auto h-28 w-28 overflow-hidden rounded-2xl shadow ring-2 ring-white md:h-32 md:w-32 dark:ring-zinc-900">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name ? `${name} profile photo` : "Persona profile photo"}
            width={256}
            height={256}
            className="h-full w-full object-cover"
            sizes="(max-width: 768px) 7rem, 8rem"
            priority
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200">
            <span className="text-xl font-semibold">
              {(name || "?")
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((w: string) => w.charAt(0).toUpperCase())
                .join("") || "?"}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const ownerDisplayName =
    study.createdByUser?.name?.trim() ||
    study.createdByUser?.email ||
    "Unknown member";

  const createdByUser = study.createdByUser ?? null;

  const createdByDisplayUser =
    createdByUser ??
    (ownerDisplayName
      ? { name: ownerDisplayName, email: undefined, image: null, status: null }
      : null);

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const createdAtFormatted = formatDateTime(study.createdAt);

  return (
    <div className="w-full">
      {coverUrl ? (
        <div className="relative mb-14 h-[25svh] w-full md:mb-16 md:h-[25vh]">
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1 print:hidden">
            <StarStudyButton
              studyId={study.id}
              userId={session.userId}
              isStarred={isStarred}
            />
            <PersonaMoreMenu
              study={study}
              userId={session.userId}
              photoKey={photoKey}
              coverKey={coverKey}
              hasAssociatedStudies={hasAssociatedStudies}
              canManage={canManageStudy}
              isStarred={isStarred}
            />
          </div>
          <Image
            src={coverUrl}
            alt={name ? `${name} cover` : "Persona cover image"}
            fill
            className="rounded-2xl object-cover"
            priority
            sizes="100vw"
            unoptimized
          />
          {avatarOverlay}
        </div>
      ) : (
        <div className="relative mb-14 h-[25svh] w-full rounded-2xl bg-gradient-to-r from-zinc-100 to-zinc-200 md:mb-16 md:h-[25vh] dark:from-zinc-800 dark:to-zinc-900">
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1 print:hidden">
            <StarStudyButton
              studyId={study.id}
              userId={session.userId}
              isStarred={isStarred}
            />
            <PersonaMoreMenu
              study={study}
              userId={session.userId}
              photoKey={photoKey}
              coverKey={coverKey}
              hasAssociatedStudies={hasAssociatedStudies}
              canManage={canManageStudy}
              isStarred={isStarred}
            />
          </div>
          {avatarOverlay}
        </div>
      )}
      <div className="container mx-auto px-4">
        <section className="pb-6 pl-0 md:pl-48" aria-labelledby="persona-title">
          <h1
            id="persona-title"
            className="scroll-m-20 text-3xl font-semibold tracking-tight"
          >
            {name || "Untitled"}
          </h1>
          {persona.description ? (
            <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
              {persona.description}
            </p>
          ) : null}
        </section>

        <div className="mb-8 grid gap-4 pl-0 text-sm text-zinc-600 sm:grid-cols-2 md:grid-cols-3 md:pl-48">
          <div>
            <p className="font-semibold text-zinc-700">Created by</p>
            <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Created on</p>
            <p>{createdAtFormatted}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Version</p>
            <p>{study.persona.version}</p>
          </div>
        </div>

        {/* Demographics */}
        {(() => {
          const demographics = persona.demographics || {};
          const items = [
            { label: "Age", value: demographics.age, Icon: Calendar },
            { label: "Gender", value: demographics.gender, Icon: GenderIcon },
            {
              label: "Ethnicity",
              value: demographics.ethnicity,
              Icon: UserIcon,
            },
            { label: "Location", value: demographics.location, Icon: MapPin },
            {
              label: "Education",
              value: demographics.education,
              Icon: GraduationCap,
            },
            { label: "Income", value: demographics.income, Icon: Banknote },
            {
              label: "Marital status",
              value: demographics.maritalStatus,
              Icon: Heart,
            },
            {
              label: "Household size",
              value: demographics.householdSize,
              Icon: Users,
            },
          ].filter(
            (i) => typeof i.value === "string" && i.value.trim().length > 0,
          );

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-demographics"
            >
              <h2
                id="persona-demographics"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Demographics
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    aria-label={`${label}: ${value}`}
                  >
                    <Icon
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs">
                        {label}
                      </div>
                      <div className="truncate leading-6 font-medium">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Psychographics */}
        {(() => {
          const pg = persona.psychographics || {};
          const normalizeList = (v: unknown): string[] => {
            if (Array.isArray(v))
              return Array.from(
                new Set(
                  v.map((s) => String(s).trim()).filter((s) => s.length > 0),
                ),
              );
            if (typeof v === "string")
              return Array.from(
                new Set(
                  v
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                ),
              );
            return [];
          };
          const toSingle = (v: unknown): string =>
            typeof v === "string"
              ? v.trim()
              : Array.isArray(v)
                ? v.join(", ")
                : "";

          const items = [
            {
              label: "Personality",
              value: toSingle(pg.personality),
              isList: false,
              Icon: Brain,
            },
            {
              label: "Interests",
              values: normalizeList(pg.interests),
              isList: true,
              Icon: Sparkles,
            },
            {
              label: "Values",
              values: normalizeList(pg.values),
              isList: true,
              Icon: Gem,
            },
            {
              label: "Motivations",
              values: normalizeList(pg.motivations),
              isList: true,
              Icon: Target,
            },
            {
              label: "Pain points",
              values: normalizeList(pg.painPoints),
              isList: true,
              Icon: AlertTriangle,
            },
          ].filter((i) =>
            (i as any).isList
              ? (i as any).values.length > 0
              : (i as any).value.length > 0,
          );

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-psychographics"
            >
              <h2
                id="persona-psychographics"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Psychographics
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const IconComp = (item as any).Icon as React.ComponentType<{
                    className?: string;
                  }>;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border p-3"
                      aria-label={`${item.label}`}
                    >
                      <IconComp
                        className="text-muted-foreground h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-muted-foreground text-xs">
                          {item.label}
                        </div>
                        {(item as any).isList ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(item as any).values.map((v: string) => (
                              <span
                                key={`${item.label}-${v}`}
                                className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-5 font-medium dark:border-zinc-700 dark:bg-zinc-800/60"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="leading-6 font-medium break-words">
                            {(item as any).value}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Behaviors */}
        {(() => {
          const bh = persona.behaviors || {};
          const normalizeList = (v: unknown): string[] => {
            if (Array.isArray(v))
              return Array.from(
                new Set(
                  v.map((s) => String(s).trim()).filter((s) => s.length > 0),
                ),
              );
            if (typeof v === "string")
              return Array.from(
                new Set(
                  v
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                ),
              );
            return [];
          };
          const toSingle = (v: unknown): string =>
            typeof v === "string"
              ? v.trim()
              : Array.isArray(v)
                ? v.join(", ")
                : "";

          const items = [
            {
              label: "Tech proficiency",
              value: toSingle(bh.techProficiency),
              isList: false,
              Icon: Cpu,
            },
            {
              label: "Primary devices",
              values: normalizeList(bh.primaryDevices),
              isList: true,
              Icon: Smartphone,
            },
            {
              label: "Preferred channels",
              values: normalizeList(bh.preferredChannels),
              isList: true,
              Icon: MessageSquare,
            },
            {
              label: "Purchase triggers",
              values: normalizeList(bh.purchaseTriggers),
              isList: true,
              Icon: Zap,
            },
          ].filter((i) =>
            (i as any).isList
              ? (i as any).values.length > 0
              : (i as any).value.length > 0,
          );

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-behaviors"
            >
              <h2
                id="persona-behaviors"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Behaviors
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const IconComp = (item as any).Icon as React.ComponentType<{
                    className?: string;
                  }>;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border p-3"
                      aria-label={`${item.label}`}
                    >
                      <IconComp
                        className="text-muted-foreground h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-muted-foreground text-xs">
                          {item.label}
                        </div>
                        {(item as any).isList ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(item as any).values.map((v: string) => (
                              <span
                                key={`${item.label}-${v}`}
                                className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-5 font-medium dark:border-zinc-700 dark:bg-zinc-800/60"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="leading-6 font-medium break-words">
                            {(item as any).value}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Tools */}
        {(() => {
          const tools = persona.tools as unknown;

          // Determine if tools are structured objects or simple strings
          const isStructured =
            Array.isArray(tools) &&
            tools.length > 0 &&
            typeof tools[0] === "object" &&
            tools[0] !== null &&
            "tool" in tools[0];

          let toolItems: {
            tool: string;
            frequency?: string;
            satisfaction?: string;
          }[] = [];

          if (isStructured) {
            toolItems = (
              tools as {
                tool: string;
                frequency?: string;
                satisfaction?: string;
              }[]
            ).filter((t) => t.tool && t.tool.trim().length > 0);
          } else if (Array.isArray(tools)) {
            // Simple string array
            toolItems = tools
              .filter((t) => typeof t === "string" && t.trim().length > 0)
              .map((t) => ({ tool: String(t).trim() }));
          } else if (typeof tools === "string" && tools.trim().length > 0) {
            // Comma-separated string
            toolItems = tools
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
              .map((t) => ({ tool: t }));
          }

          if (toolItems.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-tools"
            >
              <h2
                id="persona-tools"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Tools
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {toolItems.map((toolItem, idx) => (
                  <div
                    key={`tool-${idx}-${toolItem.tool}`}
                    className="flex items-start gap-3 rounded-xl border p-3"
                    aria-label={`Tool: ${toolItem.tool}`}
                  >
                    <Wrench
                      className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="leading-6 font-medium break-words">
                        {toolItem.tool}
                      </div>
                      {(toolItem.frequency || toolItem.satisfaction) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {toolItem.frequency && (
                            <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-5 font-medium dark:border-zinc-700 dark:bg-zinc-800/60">
                              {toolItem.frequency}
                            </span>
                          )}
                          {toolItem.satisfaction && (
                            <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-5 font-medium dark:border-zinc-700 dark:bg-zinc-800/60">
                              {toolItem.satisfaction}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Firmographics */}
        {(() => {
          const fg = persona.firmographics || {};
          const items = [
            {
              label: "Employment status",
              value: fg.employmentStatus,
              Icon: UserIcon,
            },
            { label: "Job title", value: fg.jobTitle, Icon: Briefcase },
            {
              label: "Role seniority",
              value: fg.roleSeniority,
              Icon: Briefcase,
            },
            { label: "Department", value: fg.department, Icon: Network },
            { label: "Industry", value: fg.industry, Icon: Factory },
            {
              label: "Annual Recurring Revenue",
              value: fg.annualRecurringRevenue,
              Icon: DollarSign,
            },
            { label: "Company size", value: fg.companySize, Icon: Building2 },
            {
              label: "Decision power",
              value: fg.decisionPower,
              Icon: ShieldCheck,
            },
            { label: "Budget range", value: fg.budgetRange, Icon: Wallet },
          ].filter(
            (i) => typeof i.value === "string" && i.value.trim().length > 0,
          );

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-firmographics"
            >
              <h2
                id="persona-firmographics"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Firmographics
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    aria-label={`${label}: ${value}`}
                  >
                    <Icon
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs">
                        {label}
                      </div>
                      <div className="truncate leading-6 font-medium">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {(() => {
          const goals = persona.goals as unknown;

          const normalizeGoal = (g: unknown): string => {
            if (!g) return "";
            if (typeof g === "string") return g.trim();
            if (
              typeof g === "object" &&
              g !== null &&
              ("want" in g || "soThat" in g)
            ) {
              const want =
                typeof (g as any).want === "string"
                  ? (g as any).want.trim()
                  : "";
              const soThat =
                typeof (g as any).soThat === "string"
                  ? (g as any).soThat.trim()
                  : "";
              if (want && soThat) return `${want} — so that ${soThat}`;
              return want || soThat;
            }
            return "";
          };

          let items: { label: string; value: string; Icon: any }[] = [];
          if (Array.isArray(goals)) {
            items = goals
              .map((entry) => ({
                label: "Goal",
                value: normalizeGoal(entry),
                Icon: ListChecks,
              }))
              .filter((i) => i.value.length > 0);
          } else {
            const value = normalizeGoal(goals);
            if (value) items = [{ label: "Goals", value, Icon: ListChecks }];
          }

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-goals"
            >
              <h2
                id="persona-goals"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Goals
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ label, value, Icon }, idx) => (
                  <div
                    key={`${label}-${idx}-${value.slice(0, 16)}`}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    aria-label={`${label}: ${value}`}
                  >
                    <Icon
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="leading-6 font-medium break-words">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {(() => {
          const quotes = persona.quotes as unknown;

          const toText = (v: unknown): string =>
            typeof v === "string" ? v.trim() : "";

          let items: { label: string; value: string; Icon: any }[] = [];
          if (Array.isArray(quotes)) {
            items = quotes
              .map((q) => ({ label: "Quote", value: toText(q), Icon: Quote }))
              .filter((i) => i.value.length > 0);
          } else {
            const value = toText(quotes);
            if (value) items = [{ label: "Quotes", value, Icon: Quote }];
          }

          if (items.length === 0) return null;

          return (
            <section
              className="pb-10 pl-0 md:pl-48"
              aria-labelledby="persona-quotes"
            >
              <h2
                id="persona-quotes"
                className="mb-3 text-lg font-semibold tracking-tight"
              >
                Quotes
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ label, value, Icon }, idx) => (
                  <div
                    key={`${label}-${idx}-${value.slice(0, 16)}`}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    aria-label={`${label}: ${value}`}
                  >
                    <Icon
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="leading-6 font-medium break-words">
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {personaVersions.length > 1 ? (
          <section
            className="pb-12 pl-0 md:pl-48"
            aria-labelledby="persona-versions"
          >
            <h2
              id="persona-versions"
              className="mb-3 text-lg font-semibold tracking-tight"
            >
              Version history
            </h2>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4">
                {personaVersions.map((version) => {
                  const photoUrl = versionPhotoMap.get(version.id) ?? undefined;
                  const isCurrentVersion = version.study.id === study.id;

                  return (
                    <PersonaVersionCard
                      key={version.id}
                      version={version}
                      currentUserId={session.userId}
                      photoUrl={photoUrl}
                      isCurrentVersion={isCurrentVersion}
                      className="max-w-[320px] min-w-[320px] flex-shrink-0"
                      imageClassName="h-40"
                    />
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {associatedStudies.length > 0 ? (
          <PersonaRelatedStudies
            studies={associatedStudies}
            studyPreviewMap={associatedStudyPreviewMap}
            studyVersionMap={studyToPersonaVersionMap}
            currentUserId={session.userId}
            currentVersion={currentPersonaVersion}
          />
        ) : null}
      </div>
    </div>
  );
}
