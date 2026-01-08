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
} from "@/apps/nextjs-app/lib/utils/client-logger";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type Theme = "light" | "dark";

interface ResendSignInProps {
  theme?: Theme;
  callbackUrl?: string;
}

export function ResendSignIn({
  theme = "light",
  callbackUrl,
}: ResendSignInProps) {
  // Determine redirect target - callbackUrl is already validated by parent, default to /studies
  const redirectTo = callbackUrl || "/studies";
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeError, setCodeError] = useState("");
  const RESEND_COOLDOWN_MS = 60_000;
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const storageKey = (em: string) => `otpCooldown:${em.toLowerCase()}`;

  // Theme-based styling
  const themeClasses = {
    text: theme === "dark" ? "text-white" : "text-zinc-900",
    textMuted: theme === "dark" ? "text-white/80" : "text-zinc-600",
    textMutedSmall: theme === "dark" ? "text-white/80" : "text-zinc-500",
    link: theme === "dark" ? "text-white" : "text-zinc-900",
  };

  const formatMinutes = (s: number) => {
    if (s <= 60) return "less than a minute";
    const m = Math.ceil(s / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  };
  const formatSeconds = (s: number) => `${s} ${s === 1 ? "second" : "seconds"}`;

  const isEmailValid = emailSchema.safeParse({ email }).success;

  // Automatically revert to the form after 1 minute
  useEffect(() => {
    if (!emailSent) return;
    const timer = setTimeout(() => {
      setEmailSent(false);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [emailSent]);

  // Tick down resend cooldown
  useEffect(() => {
    if (!resendAvailableAt) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const ms = resendAvailableAt - Date.now();
      const s = ms > 0 ? Math.ceil(ms / 1000) : 0;
      setSecondsLeft(s);
      if (s <= 0) setRateLimited(false);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [resendAvailableAt]);

  // Restore cooldown from localStorage when email changes
  useEffect(() => {
    if (!email) return;
    try {
      const raw = localStorage.getItem(storageKey(email));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        resendAvailableAt?: number;
        rateLimited?: boolean;
      };
      if (parsed?.resendAvailableAt && parsed.resendAvailableAt > Date.now()) {
        setResendAvailableAt(parsed.resendAvailableAt);
        setRateLimited(!!parsed.rateLimited);
      } else {
        localStorage.removeItem(storageKey(email));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Persist cooldown to localStorage whenever it changes
  useEffect(() => {
    if (!email || !resendAvailableAt) return;
    try {
      localStorage.setItem(
        storageKey(email),
        JSON.stringify({ resendAvailableAt, rateLimited }),
      );
    } catch {}
  }, [email, resendAvailableAt, rateLimited]);

  // Clear storage when cooldown ends
  useEffect(() => {
    if (secondsLeft <= 0 && email) {
      try {
        localStorage.removeItem(storageKey(email));
      } catch {}
    }
  }, [secondsLeft, email]);

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

      if (error instanceof Error && error.message.startsWith("RATE_LIMITED:")) {
        const retrySec = Number(error.message.split(":")[1]) || 60;
        setRateLimited(true);
        setResendAvailableAt(Date.now() + retrySec * 1000);
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
      <div
        className={`animate-in fade-in w-full max-w-max min-w-80 ${themeClasses.text} duration-200`}
      >
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
    <form onSubmit={handleSubmit}>
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
        <>
          <div className="mt-2 mb-4 flex items-center gap-2">
            <Button
              size="sm"
              type="submit"
              disabled={isLoading || !isEmailValid || secondsLeft > 0}
            >
              Get a link
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={isLoading || !isEmailValid || secondsLeft > 0}
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
                  if (!res.ok) {
                    if (res.status === 429) {
                      const data = await res.json().catch(() => ({}) as any);
                      const retrySec = Number(data?.retryAfterSec) || 60;
                      setRateLimited(true);
                      setResendAvailableAt(Date.now() + retrySec * 1000);
                      throw new Error("Rate limited");
                    }
                    throw new Error("Failed to send code");
                  }
                  setCodeRequested(true);
                  setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
                  setRateLimited(false);
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
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Get a code
            </Button>
          </div>
          {rateLimited && secondsLeft > 0 && (
            <p className={`-mt-2 mb-2 text-xs ${themeClasses.textMuted}`}>
              Too many requests. Try again in {formatMinutes(secondsLeft)}.
            </p>
          )}
        </>
      ) : (
        <div className="mt-4">
          <p className={`mb-2 text-sm ${themeClasses.textMuted}`}>
            Enter the 6-digit code sent to {email}
          </p>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (codeError) setCodeError("");
            }}
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
          <div className="mt-2 mb-4 flex gap-2">
            <Button
              size="sm"
              type="button"
              disabled={isLoading || code.length !== 6}
              onClick={async () => {
                setIsLoading(true);
                setCodeError("");
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
                  window.location.href = redirectTo;
                } catch (error) {
                  clientLogger.error("OTP sign-in failed", {
                    page: "/",
                    method: "otp",
                    emailDomain: getEmailDomain(email),
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                  setCode("");
                  setCodeError(
                    "An incorrect code was entered. Please try again.",
                  );
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
              variant="secondary"
              onClick={() => {
                setCode("");
                setCodeRequested(false);
                setCodeError("");
              }}
            >
              Back
            </Button>
          </div>
          <div
            className={`-mt-2 mb-2 flex items-center gap-2 text-xs ${themeClasses.textMuted}`}
          >
            <span>Didn&apos;t receive the code?</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className={`h-auto p-0 text-xs ${themeClasses.link}`}
              disabled={isLoading || secondsLeft > 0}
              onClick={async () => {
                // Re-send OTP code
                setIsLoading(true);
                setCodeError("");
                try {
                  const res = await fetch("/api/otp/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  if (!res.ok) {
                    if (res.status === 429) {
                      const data = await res.json().catch(() => ({}) as any);
                      const retrySec = Number(data?.retryAfterSec) || 60;
                      setRateLimited(true);
                      setResendAvailableAt(Date.now() + retrySec * 1000);
                      throw new Error("Rate limited");
                    }
                    throw new Error("Failed to send code");
                  }
                  setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
                  setRateLimited(false);
                  clientLogger.info("OTP code re-requested", {
                    page: "/",
                    method: "otp",
                    emailDomain: getEmailDomain(email),
                  });
                } catch (error) {
                  clientLogger.error("OTP code re-request failed", {
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
              {secondsLeft > 0
                ? rateLimited
                  ? "Resend code"
                  : `Resend in ${formatSeconds(secondsLeft)}`
                : "Resend code"}
            </Button>
            {rateLimited && secondsLeft > 0 && (
              <p className={`-mt-2 mb-2 text-xs ${themeClasses.textMuted}`}>
                Too many requests. Try again in {formatMinutes(secondsLeft)}.
              </p>
            )}
          </div>
          {codeError && (
            <p className={`-mt-2 mb-2 text-xs ${themeClasses.textMuted}`}>
              {codeError}
            </p>
          )}
        </div>
      )}
      {emailError && <p className="mt-2 text-xs">{emailError}</p>}
    </form>
  );
}
