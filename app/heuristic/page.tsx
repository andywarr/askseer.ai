import { auth } from "@/auth";
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation'
import { SignOut } from "../components/sign-out";
import { isTrial } from "../lib/data";
import { Button, Input, Radio, Typography } from "@/MTailwind";

export default async function Heuristic() {
  async function evaluate(data: FormData) {
    'use server';

    const files : File | null = data.getAll("file") as unknown as File;

    console.log(data);
  }

  const session = await auth();
  const FilePicker = dynamic(() => import('../components/file-picker'), { ssr: false });
  
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

  return (
    <div>
      <header>
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div><span className="font-black">Seer </span>Heuristic Evaluation</div>
          <SignOut />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1">
          <form action={evaluate} autoComplete="off">
            <Input
              label="Goal" 
              name="goal"
              placeholder="What is the user goal?" 
              size="lg"
              variant="standard" />
            
            <FilePicker />

            <Typography
              color="blue-gray">
              Which set of heuristics would you like to evaluate the flow?
            </Typography>

              <Radio 
                defaultChecked
                label="Nielsen"
                name="heuristic"
                value="nielsen" />

              <Radio 
                label="Tenents & Traps"
                name="heuristic"
                value="tenets"  />
            
            <div className="flex">
              <Button
                variant="gradient"
                size="sm"
                className="inline-block mt-4"
                type="submit"
              >Evaluate</Button>
              <p className="flex flex-wrap content-end ml-3"><span className="antialiased block font-light text-xs">You have {user.tries} {user.tries !== 1 ? 'tries' : 'try'} remaining.</span></p>
            </div>
            </form>
        </div>
      </main>
      
    </div>
  );
}
  