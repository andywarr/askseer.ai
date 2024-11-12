// NextAuth imports
import { signIn } from "@/auth";

// UI component imports
import { Button } from "@/components/ui/button";

export function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <Button size="sm" className="mt-4 inline-block" type="submit">
        Sign in with Google
      </Button>
    </form>
  );
}
