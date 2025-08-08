// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";

export default async function Page() {
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Account
      </h2>
    </>
  );
}
