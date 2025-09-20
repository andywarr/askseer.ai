// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { redirect } from "next/navigation";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
} from "@/apps/nextjs-app/lib/data";

// Component imports
import CompanyTeams from "@/apps/nextjs-app/components/company-teams";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  // Page access restriction: only company OWNER or ADMIN may view.
  // If there is no company for this domain or the user lacks proper role, redirect away.
  if (!domainInfo.company) {
    redirect("/");
  }

  let members: any[] = [];
  let isOwner = false;
  let isAdmin = false;
  try {
    members = await getCompanyMembers(domainInfo.company.id);
    const me = members?.find((m: any) => m.userId === user.id);
    const role = String(me?.role || "").toUpperCase();
    const hasExtendedOwnerRole = role !== "" && role.endsWith("_OWNER");
    const hasExtendedAdminRole = role !== "" && role.endsWith("_ADMIN");
    isOwner = role === "OWNER" || hasExtendedOwnerRole;
    isAdmin = role === "ADMIN" || hasExtendedAdminRole;
  } catch {
    redirect("/");
  }

  if (!isOwner && !isAdmin) {
    redirect("/");
  }

  let teams: any[] = [];
  if (domainInfo.company.status === "ACTIVE") {
    try {
      teams = await getCompanyTeams(domainInfo.company.id);
    } catch {
      teams = [];
    }
  }

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Teams
      </h2>
      {domainInfo.company.status === "PENDING" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 tracking-tight text-amber-800">
          <strong className="font-semibold">Company claim under review.</strong>{" "}
          We are verifying your domain ownership. You can continue using Seer
          while we review. Questions? Contact{" "}
          <a href="mailto:teams@askseer.ai" className="font-medium underline underline-offset-2">
            teams@askseer.ai
          </a>
          .
        </div>
      )}
      {domainInfo.company.status === "REJECTED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 tracking-tight text-red-700">
          <strong className="font-semibold">Company claim rejected.</strong> If you
          believe this was a mistake, please contact{" "}
          <a href="mailto:teams@askseer.ai" className="font-medium underline underline-offset-2">
            teams@askseer.ai
          </a>
          .
        </div>
      )}
      {domainInfo.company.status === "ACTIVE" && (
        <CompanyTeams
          companyId={domainInfo.company.id}
          teams={teams}
          canEdit={isOwner || isAdmin}
          currentUserId={user.id}
          members={members}
        />
      )}
    </>
  );
}
