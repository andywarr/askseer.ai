// Next imports
import { redirect } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/db/user";
import {
  getPersona,
  getPersonaVersions,
  isUserTeamAdmin,
  getTeam,
  getBookmarkedStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
} from "@/apps/nextjs-app/lib/db/data";
import { getPresignedUrls as getPresignedUrl } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";

// Component imports
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { PersonaVersionCard } from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-version-card";
import { PersonaRelatedStudies } from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-related-studies";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import { PersonaSectionCard } from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-section-card";
import { PersonaHeader } from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-header";
import { PersonaErrorBoundary } from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-error-boundary";
import {
  PersonaVersionsSkeleton,
  PersonaRelatedStudiesSkeleton,
} from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-skeletons";

// Utility imports
import {
  formatDateTime,
  normalizeList,
  toSingleString,
  buildDemographicsItems,
  buildPsychographicsItems,
  buildBehaviorsItems,
  buildFirmographicsItems,
} from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-utils";

// Icon imports
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

// Type imports
import type { Persona } from "@/apps/shared/jobSchema";
import type {
  PersonaVersionData,
  AssociatedStudy,
  EvaluationEntry,
} from "@/apps/nextjs-app/app/(auth)/persona/[id]/persona-types";

// Logger import
import { logger } from "@/apps/shared/logger";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const [study, bookmarkedStudyIds, shareInfo] = await Promise.all([
    getPersona(id, session.userId),
    getBookmarkedStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const isBookmarked = bookmarkedStudyIds.includes(id);
  // hasCompany: team belongs to a company (enables Private, Team, Company visibility options)
  // isPersonalTeam: personal teams don't show Team option (only Private and Company)
  const hasCompany = !!shareInfo?.team?.companyId;
  const isPersonalTeam = shareInfo?.team?.isPersonal ?? false;

  if (!study || !study.persona) {
    // Check if this study is publicly shared and redirect if so
    const publicInfo = await getStudyPublicRedirectInfo(id);
    if (publicInfo?.shareToken) {
      logger.info("Redirecting to public shared study", {
        studyId: id,
        shareToken: publicInfo.shareToken,
      });
      redirect(`/shared/${publicInfo.shareToken}`);
    }

    logger.warn("Persona not found or access denied", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      personaExists: !!study?.persona,
    });
    return <StudyAccessDenied studyType="persona" />;
  }

  logger.debug("Persona retrieved successfully", {
    userId: study.createdByUserId,
    studyId: study.id,
    fileCount: study.files.length,
  });

  const isOwner = session.userId === study.createdByUserId;

  const persona: Persona | undefined =
    (study?.persona.data.data as Persona | undefined) || undefined;

  if (!persona) {
    throw new Error("Persona not found");
  }

  const name = persona?.name || undefined;
  const coverKey: string | undefined = persona.images?.coverKey || undefined;
  const photoKey: string | undefined = persona.images?.photoKey || undefined;
  const personaGroupId = study.persona?.personaGroupId;

  // Parallelize dependent data fetches:
  // - isUserTeamAdmin (requires study.teamId)
  // - getTeam for credits (requires study.teamId)
  // - getPersonaVersions (requires personaGroupId)
  // - presigned URLs for cover and photo images
  const [
    isTeamAdmin,
    teamData,
    personaVersionsResult,
    coverUrlResult,
    photoUrlResult,
    createdByImageUrl,
  ] = await Promise.all([
    // Team admin check
    study.teamId
      ? isUserTeamAdmin(session.userId, study.teamId)
      : Promise.resolve(false),
    // Team data for credits
    study.teamId
      ? getTeam(study.teamId).catch((error) => {
          logger.warn("Failed to fetch team credits for persona edit", {
            userId: session.userId,
            studyId: study.id,
            teamId: study.teamId,
          });
          return null;
        })
      : Promise.resolve(null),
    // Persona versions
    personaGroupId
      ? getPersonaVersions(personaGroupId, session.userId).catch((error) => {
          logger.warn("Failed to fetch persona versions", {
            userId: session.userId,
            personaGroupId,
            error,
          });
          return [] as PersonaVersionData[];
        })
      : Promise.resolve([] as PersonaVersionData[]),
    // Cover presigned URL
    coverKey
      ? getPresignedUrl(coverKey)
          .then((result) => (result.success && result.data ? result.data : null))
          .catch(() => null)
      : Promise.resolve(null),
    // Photo presigned URL
    photoKey
      ? getPresignedUrl(photoKey)
          .then((result) => (result.success && result.data ? result.data : null))
          .catch(() => null)
      : Promise.resolve(null),
    // User profile image
    getUserImageUrl(study.createdByUser),
  ]);

  const canManageStudy = isOwner || isTeamAdmin;
  const credits = teamData?.credits ?? 0;
  const personaVersions: PersonaVersionData[] = personaVersionsResult;
  const coverUrl = coverUrlResult;
  const photoUrl = photoUrlResult;

  if (personaVersions.length > 0) {
    logger.debug("Persona versions retrieved successfully", {
      userId: session.userId,
      personaGroupId,
      versionCount: personaVersions.length,
    });
  }

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
  ].forEach((entry: EvaluationEntry) => {
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
        const result = await getPresignedUrl(photoKey);
        versionPhotoMap.set(
          version.id,
          result.success && result.data ? result.data : null,
        );
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
        const result = await getPresignedUrl(firstFileKey);
        associatedStudyPreviewMap.set(
          associatedStudy.id,
          result.success && result.data ? result.data : null,
        );
      } catch (error) {
        associatedStudyPreviewMap.set(associatedStudy.id, null);
      }
    }),
  );

  const ownerDisplayName =
    study.createdByUser?.name?.trim() ||
    study.createdByUser?.email ||
    "Unknown member";

  const createdByDisplayUser = study.createdByUser
    ? { ...study.createdByUser, image: createdByImageUrl }
    : ownerDisplayName
      ? { name: ownerDisplayName, email: undefined, image: null, status: null }
      : null;

  const createdAtFormatted = formatDateTime(study.createdAt);

  return (
    <PersonaErrorBoundary>
      <div className="w-full">
        <PersonaHeader
          name={name}
          coverUrl={coverUrl}
          photoUrl={photoUrl}
          study={study}
          userId={session.userId}
          isBookmarked={isBookmarked}
          shareInfo={shareInfo}
          hasCompany={hasCompany}
          isPersonalTeam={isPersonalTeam}
          photoKey={photoKey}
          coverKey={coverKey}
          hasAssociatedStudies={hasAssociatedStudies}
          canManage={canManageStudy}
        />
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
          const items = buildPsychographicsItems(
            persona.psychographics || {},
            { Brain, Sparkles, Gem, Target, AlertTriangle },
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
                  const IconComp = item.Icon;
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
                        {item.isList ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.values.map((v: string) => (
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
                            {item.value}
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
          const items = buildBehaviorsItems(
            persona.behaviors || {},
            { Cpu, Smartphone, MessageSquare, Zap },
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
                  const IconComp = item.Icon;
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
                        {item.isList ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.values.map((v: string) => (
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
                            {item.value}
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
    </PersonaErrorBoundary>
  );
}
