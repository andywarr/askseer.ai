import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { getUser } from "@/app/lib/data";
import { getHeuristicEvaluations } from "@/app/lib/data";

export default async function Page() {
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

  const heuristicEvaluations = await getHeuristicEvaluations(user.id);
  console.log(heuristicEvaluations);

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1">
        <p>Dashboard</p>
      </div>
    </main>
  );
}