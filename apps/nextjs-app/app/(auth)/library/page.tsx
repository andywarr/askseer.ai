import { redirect } from "next/navigation";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import {
  getCompanyByMyDomain,
  getHeuristicFamilies,
  isUserCompanyAdmin,
} from "@/apps/nextjs-app/lib/data";
import { LibraryHeuristics } from "@/apps/nextjs-app/components/library-heuristics";
import { logger } from "@/apps/shared/logger";

export default async function LibraryPage() {
  const { user } = await getCurrentUser();

  // Get company information to determine access level
  const domainInfo = await getCompanyByMyDomain();

  let companyId: string | null = null;
  let isCompanyAdmin = false;

  if (domainInfo?.company?.id) {
    const actualCompanyId = domainInfo.company.id;
    companyId = actualCompanyId;
    isCompanyAdmin = await isUserCompanyAdmin(user.id, actualCompanyId);
  }

  // Fetch heuristic families using server action
  const families = await getHeuristicFamilies(companyId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          Library
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse and manage heuristics for your evaluations
        </p>
      </div>
      <LibraryHeuristics
        userId={user.id}
        companyId={companyId}
        isCompanyAdmin={isCompanyAdmin}
        initialFamilies={families}
      />
    </div>
  );
}
