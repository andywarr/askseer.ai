// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getDomainUsersForCompany,
} from "@/apps/nextjs-app/lib/data";

// Component imports
import CompanyInformation from "@/apps/nextjs-app/components/company-information";
import CompanyJoin from "@/apps/nextjs-app/components/company-join";
import CompanyMembers from "@/apps/nextjs-app/components/company-members";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  // Page access restriction: only company OWNER or ADMIN may view.
  // If there is no company for this domain or the user lacks proper role, redirect away.
  let isOwner = false;
  let isAdmin = false;
  let members: any[] = [];
  if (!domainInfo.company) {
    redirect("/");
  } else {
    try {
      members = await getCompanyMembers(domainInfo.company.id);
      const me = members?.find((m: any) => m.userId === user.id);
      const role = String(me?.role || "").toUpperCase();
      const status = String(me?.status || "").toUpperCase();
      isOwner = role === "OWNER";
      isAdmin = role === "ADMIN";
      // Deactivated users cannot access company pages
      if (status === "DEACTIVATED") {
        redirect("/");
      }
      if (!isOwner && !isAdmin) {
        redirect("/");
      }
    } catch {
      redirect("/");
    }
  }

  let domainUsers: any[] = [];
  if (domainInfo.company && domainInfo.domain) {
    try {
      domainUsers = await getDomainUsersForCompany(
        domainInfo.company.id,
        domainInfo.domain,
      );
    } catch {
      domainUsers = [];
    }
  }

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Company
      </h2>
      {/* Claim flow removed from this page since only existing company owners/admins may access */}
      {domainInfo.company && domainInfo.company.status === "PENDING" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 tracking-tight text-amber-800">
          <strong className="font-semibold">Company claim under review.</strong>{" "}
          We are verifying your domain ownership. You can continue using Seer
          while we review. Questions? Contact{" "}
          <a
            href="mailto:teams@askseer.ai"
            className="font-medium underline underline-offset-2"
          >
            teams@askseer.ai
          </a>
          .
        </div>
      )}
      {domainInfo.company && domainInfo.company.status === "REJECTED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 tracking-tight text-red-700">
          <strong className="font-semibold">Company claim rejected.</strong> If
          you believe this was a mistake, please contact{" "}
          <a
            href="mailto:teams@askseer.ai"
            className="font-medium underline underline-offset-2"
          >
            teams@askseer.ai
          </a>
          .
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
          />
        </>
      )}
    </>
  );
}
