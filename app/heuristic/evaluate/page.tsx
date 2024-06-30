import { auth } from "@/auth";
import { redirect, useRouter } from 'next/navigation'

export default async function Evaluate() {
  // const router = useRouter();
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

  //console.log(router.query);

  return (
    <div>Do something with the form data.</div>
  );
}