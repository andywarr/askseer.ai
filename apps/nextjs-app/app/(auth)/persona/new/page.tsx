// Next imports
import Link from "next/link";

// Lib functions imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/nextjs-app/lib/logger";

// Component imports
import { PersonaForm } from "@/apps/nextjs-app/components/persona-form";

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
  const session = await getCurrentSession();

  logger.info("New persona page rendered successfully", {
    userId: session.userId,
  });

  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/new">New</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Persona</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PersonaForm />
    </>
  );
}
