import { redirect } from "next/navigation";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getHeuristicFamily } from "@/apps/nextjs-app/lib/data";
import { HeuristicFamilyView } from "@/apps/nextjs-app/components/heuristic-family-view";

export default async function HeuristicFamilyPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getCurrentUser();
  const params = await props.params;

  // Fetch the specific heuristic family
  const family = await getHeuristicFamily(params.id);

  if (!family) {
    redirect("/library");
  }

  return <HeuristicFamilyView family={family} />;
}
