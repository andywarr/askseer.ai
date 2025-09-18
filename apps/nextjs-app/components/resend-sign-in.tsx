"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { InputOTP } from "@/apps/nextjs-app/components/ui/input-otp";
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
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);

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

  if (emailSent && !codeRequested) {
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
    <form onSubmit={handleSubmit} className="max-h-48">
      <Input
        type="email"
        placeholder="What is your email?"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError("");
        }}
        className="bg-white/80 text-black"
      />
      {!codeRequested ? (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" type="submit" disabled={isLoading || !email}>
            Get a link
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={isLoading || !email}
            onClick={async () => {
              // Validate email with Zod
              const validation = emailSchema.safeParse({ email });
              if (!validation.success) {
                setEmailError(validation.error.errors[0].message);
                return;
              }
              setIsLoading(true);
              setEmailError("");
              try {
                const res = await fetch("/api/otp/start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                if (!res.ok) throw new Error("Failed to send code");
                setCodeRequested(true);
                clientLogger.info("OTP code requested", {
                  page: "/",
                  method: "otp",
                  emailDomain: getEmailDomain(email),
                });
              } catch (error) {
                clientLogger.error("OTP code request failed", {
                  page: "/",
                  method: "otp",
                  emailDomain: getEmailDomain(email),
                  error: error instanceof Error ? error.message : String(error),
                });
              } finally {
                setIsLoading(false);
              }
            }}
          >
            Get a code
          </Button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="mb-2 text-sm text-white/90">
            Enter the 6-digit code sent to {email}
          </p>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            containerClassName="w-full"
            render={({ slots }) => (
              <div className="flex items-center gap-2">
                {slots.map((slot, idx) => (
                  <div
                    key={idx}
                    data-active={slot.isActive}
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white/80 text-lg font-medium text-black shadow-sm data-[active=true]:border-zinc-400 data-[active=true]:ring-1 data-[active=true]:ring-zinc-400"
                    }
                  >
                    {slot.char}
                  </div>
                ))}
              </div>
            )}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              type="button"
              disabled={isLoading || code.length !== 6}
              onClick={async () => {
                setIsLoading(true);
                try {
                  const res = await signIn("otp", {
                    email,
                    code,
                    redirect: false,
                  });
                  if (res?.error) throw new Error(res.error);
                  clientLogger.info("OTP sign-in successful", {
                    page: "/",
                    method: "otp",
                    emailDomain: getEmailDomain(email),
                  });
                  // Redirect after successful sign-in
                  window.location.href = "/studies";
                } catch (error) {
                  clientLogger.error("OTP sign-in failed", {
                    page: "/",
                    method: "otp",
                    emailDomain: getEmailDomain(email),
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Verify code
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setCode("");
                setCodeRequested(false);
              }}
            >
              Back
            </Button>
          </div>
        </div>
      )}
      {emailError && <p className="mt-1 text-xs">{emailError}</p>}
    </form>
  );
}
