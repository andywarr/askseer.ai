import InviteMemberDialog from "@/apps/nextjs-app/components/invite-member-dialog";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getTeam } from "@/apps/nextjs-app/lib/data";

export default async function TeamMembers() {
  const { user } = await getCurrentUser();
  if (!user.selectedTeamId) {
    return null;
  }
  const team = await getTeam(user.selectedTeamId);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Members</h3>
        <InviteMemberDialog />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="px-2 py-1">Name</th>
            <th className="px-2 py-1">Email</th>
            <th className="px-2 py-1">Role</th>
          </tr>
        </thead>
        <tbody>
          {team?.memberships?.map((m: any) => (
            <tr key={m.userId} className="border-t">
              <td className="px-2 py-2">{m.user?.name || "-"}</td>
              <td className="px-2 py-2">{m.user?.email || "-"}</td>
              <td className="px-2 py-2 capitalize">{m.role.toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

