// Next imports
import Link from "next/link";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { getUser } from "@/apps/nextjs-app/lib/data";

// Component imports
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/components/heuristic-evaluation-form";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

export default async function Heuristic() {
  const session = await isAuthenticated();

  const user = await getUser(session.userId);

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Evaluation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <HeuristicEvaluationForm credits={user.credits} />
    </div>
  );
}
