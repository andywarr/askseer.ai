"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { useState } from "react";

export function ResendSignIn() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn("resend", {
        email,
        redirect: false, // Prevent automatic redirect
      });
      setEmailSent(true);
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="mt-4 h-24 max-h-24 w-full min-w-80 max-w-max overflow-y-hidden text-white duration-200 animate-in fade-in">
        <p className="max-w-xs text-sm">
          A sign in link has been sent to {email}.
        </p>
        <p className="mt-2 max-w-xs text-sm">
          Click the link in the email to complete the sign in process.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 h-24 max-h-24 overflow-y-hidden"
    >
      <Input
        type="email"
        placeholder="What is your email?"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-white/80 text-black"
      />
      <Button
        size="sm"
        className="mt-2 inline-block"
        type="submit"
        disabled={isLoading || !email}
      >
        {isLoading ? "Sending..." : "Sign in with Email"}
      </Button>
    </form>
  );
}
