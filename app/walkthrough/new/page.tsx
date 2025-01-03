// Next imports
import Link from "next/link";

// Lib functions imports
import { isAuthenticated } from "@/app/lib/dal";
import { getUser } from "@/app/lib/data";

// Component imports
import { CognitiveWalkthroughForm } from "@/app/components/cognitive-walkthrough-form";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function Heuristic() {
  const session = await isAuthenticated();

  const user = await getUser(session.userId);

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>
              <Link href="/heuristic">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <CognitiveWalkthroughForm credits={user.credits} />
    </div>
  );
}
