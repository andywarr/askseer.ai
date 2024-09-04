import { auth } from "@/auth";
import { getUser } from "@/app/lib/data";
import { HeuristicEvaluationForm } from "@/app/components/heuristic-evaluation-form";
import { redirect } from 'next/navigation'
import { verifySession } from "@/app/lib/dal";

export default async function Heuristic() {
  const session = await verifySession();

  const user = await getUser(session.userId);

  // If a user does not exist there is a problem
  if (!user) {
    redirect("/error");
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1">
        <HeuristicEvaluationForm credits={user.credits} />
      </div>
    </main>
  );
}
