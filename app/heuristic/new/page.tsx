import { auth } from "@/auth";
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation'
import { getUser } from "@/app/lib/data";
import { HeuristicEvaluationForm } from "@/app/components/heuristic-evaluation-form";

export default async function Heuristic() {  
  const session = await auth();

  // If session does not exist the user should not be here
  if (!session) {
    redirect("/");
  }

  // If session.user does not exist there is a problem
  if (!session.user?.id) {
    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    };
  }

  const user = await getUser(session.user?.id);

  // If user does not exist there is a problem
  if (user == null) {
    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    };
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1">
        <HeuristicEvaluationForm user={user} />
      </div>
    </main>
  );
}
  