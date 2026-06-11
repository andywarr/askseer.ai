// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getDomainUsersForCompany,
} from "@/apps/nextjs-app/lib/db/data";
import { getTranslations } from "next-intl/server";

// Component imports
import CompanyInformation from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/company/company-information";
import CompanyJoin from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/company/company-join";
import CompanyMembers from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/company/company-members";
import CompanyDangerZone from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/company/company-danger-zone";
import type { Member, Team, DomainUser } from "./types";


export default async function Page() {
  const t = await getTranslations("CompanySettings");
  // Parallelize independent initial fetches to eliminate waterfall
  const [{ user }, domainInfo] = await Promise.all([
    getCurrentUser(),
    getCompanyByMyDomain(),
  ]);

  // Page access restriction: only company OWNER or ADMIN may view.
  // If there is no company for this domain or the user lacks proper role, redirect away.
  if (!domainInfo.company) {
    redirect("/");
  }

  let isOwner = false;
  let isAdmin = false;
  let members: Member[] = [];

  try {
    members = await getCompanyMembers(domainInfo.company.id);
    const me = members?.find((m) => m.userId === user.id);
    // If user is not in the members list or is deactivated, redirect
    if (!me || me.status === "DEACTIVATED") {
      redirect("/");
    }
    const role = String(me.role || "").toUpperCase();
    isOwner = role === "OWNER";
    isAdmin = role === "ADMIN";
    if (!isOwner && !isAdmin) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  // Parallelize independent secondary fetches
  let domainUsers: DomainUser[] = [];
  let teams: Team[] = [];
  if (domainInfo.domain) {
    const results = await Promise.allSettled([
      getDomainUsersForCompany(domainInfo.company.id, domainInfo.domain),
      getCompanyTeams(domainInfo.company.id),
    ]);
    domainUsers = results[0].status === "fulfilled" ? results[0].value : [];
    teams = results[1].status === "fulfilled" ? results[1].value : [];
  }

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        {t("title")}
      </h2>
      {/* Claim flow removed from this page since only existing company owners/admins may access */}
      {domainInfo.company && domainInfo.company.status === "PENDING" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 tracking-tight text-amber-800">
          {t.rich("claimUnderReview", {
            bold: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            email: (chunks) => (
              <a
                href="mailto:teams@askseer.ai"
                className="font-medium underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </div>
      )}
      {domainInfo.company && domainInfo.company.status === "REJECTED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 tracking-tight text-red-700">
          {t.rich("claimRejected", {
            bold: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            email: (chunks) => (
              <a
                href="mailto:teams@askseer.ai"
                className="font-medium underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </div>
      )}
      {domainInfo.company && domainInfo.company.status === "ACTIVE" && (
        <>
          <CompanyInformation
            domain={domainInfo.domain!}
            company={{
              id: domainInfo.company.id,
              name: domainInfo.company.name,
              status: domainInfo.company.status,
              logoKey: domainInfo.company.logoKey || null,
              logoUpdatedAt: domainInfo.company.logoUpdatedAt || null,
            }}
            isOwner={isOwner}
          />
          <CompanyJoin
            companyId={domainInfo.company.id}
            domain={domainInfo.domain!}
            autoEnroll={domainInfo.company.autoEnroll ?? false}
            personalTeamsDisabled={
              domainInfo.company.disablePersonalTeams ?? true
            }
            isOwner={isOwner}
            domainUsers={domainUsers}
          />
          <CompanyMembers
            companyId={domainInfo.company.id}
            members={members}
            canEdit={isOwner || isAdmin}
            currentUserId={user.id}
            teams={teams}
          />
          <CompanyDangerZone
            companyId={domainInfo.company.id}
            companyName={domainInfo.company.name}
            canDelete={isOwner || isAdmin}
          />
        </>
      )}
    </>
  );
}
