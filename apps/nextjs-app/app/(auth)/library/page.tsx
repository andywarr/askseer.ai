import { redirect } from "next/navigation";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getHeuristicFamilies,
  isUserCompanyAdmin,
} from "@/apps/nextjs-app/lib/db/data";
import { LibraryHeuristics } from "@/apps/nextjs-app/app/(auth)/library/heuristics/library-heuristics";
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

    // Parallelize independent data fetches
    const [membersResult, adminResult] = await Promise.allSettled([
      getCompanyMembers(actualCompanyId),
      isUserCompanyAdmin(user.id, actualCompanyId),
    ]);

    // Check if user is deactivated in the company
    if (membersResult.status === "fulfilled") {
      const members = membersResult.value;
      const me = members.find((m) => m.userId === user.id);
      if (me && me.status === "DEACTIVATED") {
        redirect("/");
      }
    } else {
      // If we can't fetch members, redirect for safety
      redirect("/");
    }

    // Set admin status
    isCompanyAdmin =
      adminResult.status === "fulfilled" ? adminResult.value : false;
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
