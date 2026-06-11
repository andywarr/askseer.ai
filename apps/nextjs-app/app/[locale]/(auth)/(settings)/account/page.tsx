// Lib function imports
import { getCurrentUser, isCompanyMember } from "@/apps/nextjs-app/lib/db/user";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import { getCommunicationPreferences } from "@/apps/nextjs-app/lib/db/data";
import { getTranslations } from "next-intl/server";

// Component imports
import AccountInformation from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/account/account-information";
import CommunicationsPreferences from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/account/communication-preferences";
import AccountApps from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/account/account-apps";
import AccountDangerZone from "@/apps/nextjs-app/app/[locale]/(auth)/(settings)/account/account-danger-zone";

export default async function Page() {
  const t = await getTranslations("AccountSettings");

  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  // Parallelize independent data fetches to eliminate waterfall
  const [imageUrl, isUserCompanyMember, communicationPrefs] = await Promise.all(
    [
      getUserImageUrl(user),
      isCompanyMember(user.id),
      getCommunicationPreferences(user.id),
    ],
  );

  return (
    <div className="space-y-8">
      <h2 className="mb-8 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        {t("title")}
      </h2>
      <AccountInformation
        name={user.name ?? ""}
        email={user.email ?? ""}
        image={imageUrl ?? undefined}
        userId={user.id}
        imageKey={user.imageKey}
        imageUpdatedAt={user.imageUpdatedAt?.toISOString?.() || null}
      />
      <CommunicationsPreferences
        userId={user.id}
        initialPreferences={communicationPrefs}
      />
      <AccountApps />
      {!isUserCompanyMember && <AccountDangerZone userId={user.id} />}
    </div>
  );
}

