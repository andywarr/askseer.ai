import { redirect } from "next/navigation";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import {
  getHeuristic,
  getCompanyByMyDomain,
  isUserCompanyAdmin,
} from "@/apps/nextjs-app/lib/db/data";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/apps/nextjs-app/components/ui/card";
import { AddExampleForm } from "@/apps/nextjs-app/app/[locale]/(auth)/library/heuristics/[id]/[heuristicId]/add-example-dialog";

interface HeuristicExample {
  id: string;
  title?: string;
  example: string;
}

export default async function HeuristicPage(props: {
  params: Promise<{ id: string; heuristicId: string }>;
}) {
  const t = await getTranslations("Library");
  const { user } = await getCurrentUser();
  const params = await props.params;

  // Get company information first
  const domainInfo = await getCompanyByMyDomain();
  const companyId = domainInfo?.company?.id || null;

  // Fetch the specific heuristic with companyId for proper example filtering
  const heuristic = await getHeuristic(params.heuristicId, companyId);

  if (!heuristic) {
    redirect(`/library/heuristics/${params.id}`);
  }

  // Check if user is company admin (for company-specific heuristics)
  let canAddExamples = false;

  if (companyId) {
    const isCompanyAdmin = await isUserCompanyAdmin(user.id, companyId);

    // User can add examples if they're a company admin and the heuristic belongs to their company
    canAddExamples =
      isCompanyAdmin && heuristic.family?.companyId === companyId;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
              {heuristic.label || heuristic.heuristic}
            </h1>
          </div>
          {heuristic.category && (
            <Badge variant="secondary" className="text-sm">
              {heuristic.category}
            </Badge>
          )}
        </div>

        {heuristic.label && (
          <p className="mt-2 text-lg text-zinc-700 dark:text-zinc-300">
            {heuristic.heuristic}
          </p>
        )}

        {heuristic.description && (
          <p className="text-muted-foreground mt-2 text-base">
            {heuristic.description}
          </p>
        )}
      </div>

      {/* Example Violations Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">{t("exampleViolations")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("exampleViolationsDesc")}
          </p>
        </div>

        {heuristic.examples && heuristic.examples.length > 0 ? (
          <div className="mb-4 grid auto-rows-auto grid-cols-1 gap-4">
            {heuristic.examples.map((example: HeuristicExample) => (
              <Card key={example.id}>
                <CardHeader>
                  {example.title && (
                    <CardTitle className="text-lg">{example.title}</CardTitle>
                  )}
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {example.example}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-muted-foreground text-sm text-zinc-500">
              {t("noExampleViolations")}
            </p>
          </div>
        )}

        {/* Add Example Form */}
        {canAddExamples && <AddExampleForm heuristicId={params.heuristicId} />}
      </div>
    </div>
  );
}
