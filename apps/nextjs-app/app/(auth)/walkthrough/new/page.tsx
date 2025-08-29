// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger.ts";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/components/cognitive-walkthrough-form";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  logger.info("New walkthrough page rendered successfully", {
    userId: user.id,
  });

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/new">New</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Walkthrough</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <CognitiveWalkthroughForm credits={user.credits} />
    </div>
  );
}
