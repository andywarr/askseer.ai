import { Button } from "@/MTailwind";
import { signOutServerAction } from "@/app/lib/action"

export function SignOut() {
  return (
    <form
      action={signOutServerAction}
    >
      <Button variant="text" size="sm" type="submit">
        Signout
      </Button>
    </form>
  );
}
