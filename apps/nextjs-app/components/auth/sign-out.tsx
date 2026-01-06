// Server action imports
import { signOutServerAction } from "@/apps/nextjs-app/lib/actions/auth-actions";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

export function SignOut() {
  return (
    <form action={signOutServerAction}>
      <Button variant="link" size="sm" type="submit">
        Signout
      </Button>
    </form>
  );
}
