// Lib function imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/data";
import { isFigmaOAuthEnabled } from "@/apps/nextjs-app/lib/feature-flags";

// Component imports
import AccountInformation from "../../../../components/account-information";
import CommunicationsPreferences from "@/apps/nextjs-app/components/communication-preferences";
import AccountApps from "@/apps/nextjs-app/components/account-apps";
import AccountDangerZone from "@/apps/nextjs-app/components/account-danger-zone";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const figmaOAuthEnabled = isFigmaOAuthEnabled(
    new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k, v as string]),
    ),
  );

  // Get user data (authentication already verified in layout)
  const { user } = await getCurrentUser();

  const imageUrl = user.imageKey
    ? await getPresignedUrls(user.imageKey)
    : user.image; // fallback to google image when no uploaded image

  let isCompanyMember = false;
  try {
    const domainInfo = await getCompanyByMyDomain();
    if (domainInfo.company?.id) {
      const members = await getCompanyMembers(domainInfo.company.id);
      isCompanyMember = members.some(
        (member) => member.userId === user.id && member.status === "ACTIVE",
      );
    }
  } catch {
    isCompanyMember = false;
  }

  return (
    <>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Account Settings
      </h2>
      <AccountInformation
        name={user.name ?? ""}
        email={user.email ?? ""}
        image={imageUrl}
        userId={user.id}
        imageKey={user.imageKey}
        imageUpdatedAt={user.imageUpdatedAt?.toISOString?.() || null}
      />
      <div className="my-8" />
      <CommunicationsPreferences userId={user.id} />
      {figmaOAuthEnabled && (
        <>
          <div className="my-8" />
          <AccountApps />
        </>
      )}
      {!isCompanyMember && (
        <>
          <div className="my-8" />
          <AccountDangerZone userId={user.id} />
        </>
      )}
    </>
  );
}
