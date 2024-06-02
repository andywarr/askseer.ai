import { auth } from "@/auth";
import { redirect } from 'next/navigation'
import { SignOut } from "../components/sign-out";
import { isTrial } from "../lib/data";

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

  const user = await isTrial(session.user.id);

  console.log(user);

  return (
    <div>
      <p>The user has {user.tries} tries.</p>
      <SignOut />
    </div>
  );
}
  