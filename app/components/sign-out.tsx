import { signOut } from "@/auth";
import {
  Button
} from "@/MTailwind";
 
export function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <Button
        variant="gradient"
        size="sm"
        className="hidden lg:inline-block"
        type="submit"
      >Signout</Button>
    </form>
  )
}