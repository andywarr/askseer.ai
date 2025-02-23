// Lib function imports
import { signOutServerAction } from "@/lib/action";

// UI component imports
import { Button } from "@/components/ui/button";

export function SignOut() {
  return (
    <form action={signOutServerAction}>
      <Button variant="link" size="sm" type="submit">
        Signout
      </Button>
    </form>
  );
}
