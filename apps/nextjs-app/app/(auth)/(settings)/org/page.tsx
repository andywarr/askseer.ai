// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import {
  createCompanyForMyDomain,
  getCompanyByMyDomain,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/data";

// Component imports
import CompanyForDomain from "@/apps/nextjs-app/components/company-for-domain";
import CompanyInformation from "@/apps/nextjs-app/components/company-information";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();
  const domainInfo = await getCompanyByMyDomain();

  // If user has a company, compute whether they are an OWNER for edit permissions
  let isOwner = false;
  if (domainInfo.company) {
    try {
      const members = await getCompanyMembers(domainInfo.company.id);
      isOwner = !!members?.find(
        (m: any) =>
          m.userId === user.id && String(m.role).toUpperCase() === "OWNER",
      );
    } catch {
      isOwner = false;
    }
  }

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Organization Settings
      </h2>
      {domainInfo.company ? (
        <CompanyInformation
          domain={domainInfo.domain!}
          company={{
            id: domainInfo.company.id,
            name: domainInfo.company.name,
            status: domainInfo.company.status,
            // Map backend image fields to CompanyInformation props
            logoKey: domainInfo.company.logoKey || null,
            logoUpdatedAt: domainInfo.company.logoUpdatedAt || null,
          }}
          isOwner={isOwner}
        />
      ) : (
        <CompanyForDomain
          domain={domainInfo.domain}
          isConsumer={domainInfo.isConsumer}
          company={domainInfo.company}
          onCreate={async (name?: string) => {
            "use server";
            try {
              const res = await createCompanyForMyDomain(name);
              return { success: true };
            } catch (e: any) {
              return { success: false, error: e?.message || "Failed" };
            }
          }}
        />
      )}
    </>
  );
}
