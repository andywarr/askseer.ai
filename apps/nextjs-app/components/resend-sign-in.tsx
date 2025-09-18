"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  clientLogger,
  getEmailDomain,
} from "@/apps/nextjs-app/lib/client-logger";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export function ResendSignIn() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Automatically revert to the form after 1 minute
  useEffect(() => {
    if (!emailSent) return;
    const timer = setTimeout(() => {
      setEmailSent(false);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [emailSent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    // Validate email with Zod
    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setEmailError(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    // Log email sign-in attempt
    clientLogger.debug("Email sign-in attempted", {
      page: "/",
      method: "email",
      emailDomain: getEmailDomain(email),
    });

    try {
      await signIn("resend", {
        email,
        redirect: false,
      });
      setEmailSent(true);

      // Log successful email sign-in
      clientLogger.info("Email sign-in successful", {
        page: "/",
        method: "email",
        emailDomain: getEmailDomain(email),
      });
    } catch (error) {
      // NEXT_REDIRECT is expected behavior for successful sign-in with redirect
      if (
        error instanceof Error &&
        (error.message === "NEXT_REDIRECT" ||
          error.message.includes("NEXT_REDIRECT"))
      ) {
        throw error; // Success case - user will be redirected
      }

      clientLogger.error("Email sign-in failed", {
        page: "/",
        method: "email",
        emailDomain: getEmailDomain(email),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="animate-in fade-in h-24 max-h-24 w-full max-w-max min-w-80 text-white duration-200">
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
    <form onSubmit={handleSubmit} className="h-24 max-h-24">
      <Input
        type="text"
        placeholder="What is your email?"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError(""); // Clear error on change
        }}
        className="bg-white/80 text-black"
      />
      <Button
        size="sm"
        className="mt-2 inline-block"
        type="submit"
        disabled={isLoading || !email}
      >
        Get a link
      </Button>
      {emailError && <p className="mt-1 text-xs">{emailError}</p>}
    </form>
  );
}
