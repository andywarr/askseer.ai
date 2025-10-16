import { redirect } from "next/navigation";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import {
  getCompanyByMyDomain,
  isUserCompanyAdmin,
} from "@/apps/nextjs-app/lib/data";
import { NewHeuristicSetForm } from "@/apps/nextjs-app/components/new-heuristic-set-form";

export default async function Page() {
  const { user } = await getCurrentUser();

  // Get company information to determine access level
  const domainInfo = await getCompanyByMyDomain();

  if (!domainInfo?.company?.id) {
    redirect("/library");
  }

  const companyId = domainInfo.company.id;
  const isCompanyAdmin = await isUserCompanyAdmin(user.id, companyId);

  if (!isCompanyAdmin) {
    redirect("/library");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          Add Heuristics
        </h1>
        <p className="text-muted-foreground mt-2">
          Add a custom heuristic set for your company
        </p>
      </div>
      <NewHeuristicSetForm companyId={companyId} />
    </div>
  );
}
