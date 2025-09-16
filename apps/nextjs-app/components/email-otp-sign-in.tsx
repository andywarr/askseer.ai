"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/apps/nextjs-app/components/ui/input-otp";
import {
  clientLogger,
  getEmailDomain,
} from "@/apps/nextjs-app/lib/client-logger";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const otpSchema = z
  .string()
  .regex(/^[0-9]{6}$/u, "Enter the 6-digit code from your email");

type Stage = "email" | "otp";

type ChallengeResponse = {
  flowId: string;
  expiresAt?: string;
  resendAvailableAt?: string;
};

const OTP_LENGTH = 6;
const VERIFY_REDIRECT_PATH = "/studies";

export function EmailOtpSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [flowId, setFlowId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [hydratedFromLink, setHydratedFromLink] = useState(false);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendCountdown(0);
      return;
    }

    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000),
      );
      setResendCountdown(seconds);
      if (seconds <= 0) {
        setResendAvailableAt(null);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  useEffect(() => {
    if (!codeExpiresAt) {
      setExpiresInSeconds(null);
      return;
    }

    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((codeExpiresAt - Date.now()) / 1000),
      );
      setExpiresInSeconds(seconds > 0 ? seconds : null);
      if (seconds <= 0) {
        setCodeExpiresAt(null);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  useEffect(() => {
    if (hydratedFromLink) {
      return;
    }
    const emailParam = searchParams?.get("email");
    const flowParam = searchParams?.get("flow");

    if (emailParam && flowParam) {
      const validation = emailSchema.safeParse({ email: emailParam });
      if (validation.success) {
        const normalizedEmail = validation.data.email;
        setEmail(normalizedEmail);
        setFlowId(flowParam);
        setStage("otp");
        setInfoMessage(
          `Enter the 6-digit code we sent to ${normalizedEmail}. It expires in 10 minutes.`,
        );
        setError("");
        setOtpCode("");
        setHydratedFromLink(true);
      }
    }

    if ((emailParam || flowParam) && typeof window !== "undefined") {
      const params = new URLSearchParams(searchParams?.toString());
      params.delete("email");
      params.delete("flow");
      const queryString = params.toString();
      router.replace(
        queryString ? `?${queryString}` : window.location.pathname,
      );
    }
  }, [hydratedFromLink, router, searchParams]);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? "Invalid email");
      return;
    }

    await requestChallenge(validation.data.email);
  };

  const requestChallenge = async (targetEmail: string) => {
    setIsSending(true);
    setError("");

    clientLogger.debug("OTP email requested", {
      page: "/",
      method: "email_otp",
      emailDomain: getEmailDomain(targetEmail),
    });

    try {
      const response = await fetch("/api/auth/otp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const payload: ChallengeResponse | { error?: string; retryAfter?: number } =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload && typeof payload === "object" && "retryAfter" in payload) {
          if (payload.retryAfter && payload.retryAfter > 0) {
            setResendAvailableAt(Date.now() + payload.retryAfter * 1000);
          }
        }
        setError(
          (payload as { error?: string })?.error ||
            "We couldn’t send a code. Please try again.",
        );
        clientLogger.warn("OTP email request rejected", {
          page: "/",
          method: "email_otp",
          emailDomain: getEmailDomain(targetEmail),
          status: response.status,
        });
        return;
      }

      const challenge = payload as ChallengeResponse;
      setEmail(targetEmail);
      setFlowId(challenge.flowId);
      setStage("otp");
      setOtpCode("");
      setError("");
      setInfoMessage(
        `Enter the 6-digit code we sent to ${targetEmail}. It expires in 10 minutes.`,
      );

      const nextResendAt = challenge.resendAvailableAt
        ? Date.parse(challenge.resendAvailableAt)
        : Number.NaN;
      setResendAvailableAt(
        Number.isFinite(nextResendAt)
          ? nextResendAt
          : Date.now() + 45_000,
      );

      const nextExpiry = challenge.expiresAt
        ? Date.parse(challenge.expiresAt)
        : Number.NaN;
      setCodeExpiresAt(
        Number.isFinite(nextExpiry)
          ? nextExpiry
          : Date.now() + 10 * 60_000,
      );

      setHydratedFromLink(true);

      clientLogger.info("OTP email sent", {
        page: "/",
        method: "email_otp",
        emailDomain: getEmailDomain(targetEmail),
      });
    } catch (err) {
      setError("Something went wrong. Please try again.");
      clientLogger.error("OTP email request failed", {
        page: "/",
        method: "email_otp",
        emailDomain: getEmailDomain(targetEmail),
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const codeValidation = otpSchema.safeParse(otpCode);
    if (!codeValidation.success) {
      setError(codeValidation.error.errors[0]?.message ?? "Invalid code");
      return;
    }

    setIsVerifying(true);

    clientLogger.debug("OTP verification attempted", {
      page: "/",
      method: "email_otp",
      emailDomain: getEmailDomain(email),
    });

    try {
      const result = await signIn("otp", {
        email,
        flowId,
        code: codeValidation.data,
        redirect: false,
        callbackUrl: VERIFY_REDIRECT_PATH,
      });

      if (result?.error) {
        const message = mapOtpError(result.error);
        setError(message);
        clientLogger.warn("OTP verification failed", {
          page: "/",
          method: "email_otp",
          emailDomain: getEmailDomain(email),
          error: result.error,
        });
        return;
      }

      clientLogger.info("OTP verification succeeded", {
        page: "/",
        method: "email_otp",
        emailDomain: getEmailDomain(email),
      });

      if (result?.url) {
        window.location.href = result.url;
      } else {
        router.push(VERIFY_REDIRECT_PATH);
        router.refresh();
      }
    } catch (err) {
      setError("We couldn’t verify that code. Please try again.");
      clientLogger.error("OTP verification unexpected error", {
        page: "/",
        method: "email_otp",
        emailDomain: getEmailDomain(email),
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCountdown > 0) {
      return;
    }
    await requestChallenge(email);
  };

  const resetToEmailStage = () => {
    setStage("email");
    setFlowId("");
    setOtpCode("");
    setResendAvailableAt(null);
    setCodeExpiresAt(null);
    setInfoMessage("");
    setError("");
  };

  if (stage === "otp") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <p className="text-sm text-white/90">{infoMessage}</p>
        <InputOTP
          maxLength={OTP_LENGTH}
          value={otpCode}
          onChange={(value) => {
            setOtpCode(value);
            if (error) setError("");
          }}
        >
          <InputOTPGroup>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            type="submit"
            disabled={isVerifying || otpCode.length !== OTP_LENGTH}
            className="inline-flex"
          >
            {isVerifying ? "Verifying…" : "Verify code"}
          </Button>
          <div className="flex items-center justify-between text-xs text-white/80">
            <button
              type="button"
              className="underline"
              onClick={resetToEmailStage}
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending || resendCountdown > 0}
              className="underline disabled:no-underline"
            >
              {resendCountdown > 0
                ? `Resend in ${formatSeconds(resendCountdown)}`
                : isSending
                  ? "Sending…"
                  : "Resend code"}
            </button>
          </div>
          {expiresInSeconds !== null && (
            <p className="text-xs text-white/70">
              Code expires in {formatSeconds(expiresInSeconds)}.
            </p>
          )}
          {error && <p className="text-xs text-red-100">{error}</p>}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit} className="flex h-24 max-h-24 flex-col">
      <Input
        type="email"
        placeholder="What is your email?"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (error) setError("");
        }}
        className="bg-white/80 text-black"
      />
      <Button
        size="sm"
        className="mt-2 inline-block"
        type="submit"
        disabled={isSending || !email}
      >
        {isSending ? "Sending…" : "Sign in with Email"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-100">{error}</p>}
    </form>
  );
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function mapOtpError(error: string) {
  switch (error) {
    case "OTP_RATE_LIMIT":
      return "Too many attempts. Please wait a bit before trying again.";
    case "OTP_LOCKED":
      return "This code can no longer be used. Request a new one.";
    case "OTP_INVALID":
    case "CredentialsSignin":
      return "That code didn’t work. Double-check the email and try again.";
    default:
      return "We couldn’t verify that code. Please try again.";
  }
}
