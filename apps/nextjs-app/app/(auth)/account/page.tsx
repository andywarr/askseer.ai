// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";

// Component imports
import AccountInformation from "../../../components/account-information";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Account
      </h2>
      <AccountInformation
        name={user.name ?? ""}
        email={user.email ?? ""}
        image={user.image ?? undefined}
        userId={user.id}
      />
    </>
  );
}
