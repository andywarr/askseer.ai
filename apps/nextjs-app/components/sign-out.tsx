"use client";

// NextAuth imports
import { signOut } from "next-auth/react";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

export function SignOut() {
  const handleSignOut = async () => {
    try {
      await signOut({ 
        callbackUrl: "/",
        redirect: true 
      });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <Button variant="link" size="sm" onClick={handleSignOut}>
      Signout
    </Button>
  );
}
