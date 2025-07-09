// NextAuth imports
import { signIn } from "@/apps/nextjs-app/auth";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

export function GoogleSignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/studies" });
      }}
    >
      <Button size="sm" className="mt-4 inline-block" type="submit">
        Sign in with Google
      </Button>
    </form>
  );
}
