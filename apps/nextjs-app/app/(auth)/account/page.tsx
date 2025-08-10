// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";

// Component imports
import AccountInformation from "../../../components/account-information";
import CommunicationsPreferences from "@/apps/nextjs-app/components/communication-preferences";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  const imageUrl = user.imageKey
    ? await getPresignedUrls(user.imageKey)
    : user.image; // fallback to google image when no uploaded image

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Account
      </h2>
      <AccountInformation
        name={user.name ?? ""}
        email={user.email ?? ""}
        image={imageUrl}
        userId={user.id}
        imageKey={user.imageKey}
        imageUpdatedAt={user.imageUpdatedAt?.toISOString?.() || null}
      />
      <CommunicationsPreferences userId={user.id} />
    </>
  );
}
