// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/db/data";

// Component imports
import AccountInformation from "@/apps/nextjs-app/app/(auth)/(settings)/account/account-information";
import CommunicationsPreferences from "@/apps/nextjs-app/app/(auth)/(settings)/account/communication-preferences";
import AccountApps from "@/apps/nextjs-app/app/(auth)/(settings)/account/account-apps";
import AccountDangerZone from "@/apps/nextjs-app/app/(auth)/(settings)/account/account-danger-zone";

export default async function Page() {
  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  const imageUrl = await getUserImageUrl(user);

  let isCompanyMember = false;
  try {
    const domainInfo = await getCompanyByMyDomain();
    if (domainInfo.company?.id) {
      const members = await getCompanyMembers(domainInfo.company.id);
      isCompanyMember = members.some(
        (member) => member.userId === user.id && member.status === "ACTIVE",
      );
    }
  } catch (error) {
    console.error("Failed to check company membership:", error);
    isCompanyMember = false;
  }

  return (
    <div className="space-y-8">
      <h2 className="mb-8 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Account Settings
      </h2>
      <AccountInformation
        name={user.name ?? ""}
        email={user.email ?? ""}
        image={imageUrl ?? undefined}
        userId={user.id}
        imageKey={user.imageKey}
        imageUpdatedAt={user.imageUpdatedAt?.toISOString?.() || null}
      />
      <CommunicationsPreferences userId={user.id} />
      <AccountApps />
      {!isCompanyMember && <AccountDangerZone userId={user.id} />}
    </div>
  );
}

