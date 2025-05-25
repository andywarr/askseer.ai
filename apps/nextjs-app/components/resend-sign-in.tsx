// NextAuth imports
import { signIn } from "@/apps/nextjs-app/auth";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";

export function ResendSignIn() {
  return (
    <form
      action={async (formData) => {
        "use server";
        await signIn("resend", formData);
      }}
    >
      <Input
        type="text"
        name="email"
        placeholder="What is your email?"
        className="mt-4 bg-white text-black"
      />
      <Button size="sm" className="mt-4 inline-block" type="submit">
        Sign in
      </Button>
    </form>
  );
}
