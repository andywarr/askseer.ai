import { Button } from "@/components/ui/button";
import { signOutServerAction } from "@/app/lib/action";

export function SignOut() {
  return (
    <form action={signOutServerAction}>
      <Button variant="link" size="sm" type="submit">
        Signout
      </Button>
    </form>
  );
}
