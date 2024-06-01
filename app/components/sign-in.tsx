import { signIn } from "@/auth";
import {
  Button
} from "@/MTailwind";
 
export function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button
        variant="gradient"
        size="sm"
        className="hidden lg:inline-block"
        type="submit"
      >Signin with Google</Button>
    </form>
  )
} 