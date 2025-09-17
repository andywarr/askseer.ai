"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { z } from "zod";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import {
  clientLogger,
  getEmailDomain,
} from "@/apps/nextjs-app/lib/client-logger";

const emailSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

const otpSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/u, "Enter the six digit code we emailed you.");

const OTP_ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  invalid_otp_format: "Enter the six digit code we emailed you.",
  otp_not_found: "We couldn't find an active code. Request a new one.",
  otp_locked: "Too many attempts for this code. Request a new one.",
  otp_expired: "That code has expired. Request a new one.",
  otp_invalid: "That code didn't match. Double-check and try again.",
  verify_rate_limited:
    "Too many verification attempts. Please wait 10 minutes and try again.",
  otp_unknown_error: "We couldn't verify the code. Please try again.",
};

function mapOtpError(code?: string | null) {
  if (!code) return OTP_ERROR_MESSAGES.otp_unknown_error;
  const normalized = code.toLowerCase();
  return (
    OTP_ERROR_MESSAGES[normalized] ?? OTP_ERROR_MESSAGES.otp_unknown_error
  );
}

function mapRequestError(message?: string | null) {
  if (!message) {
    return "We couldn't send the code. Please try again.";
  }

  const normalized = message.toLowerCase();

  if (normalized === "configuration" || normalized === "accessdenied") {
    return "We couldn't send the code. Please try again.";
  }

  if (normalized.includes("30") && normalized.includes("second")) {
    return "Please wait 30 seconds before requesting another code.";
  }
  if (normalized.includes("10") && normalized.includes("minute")) {
    return "You've requested too many codes. Please wait 10 minutes and try again.";
  }
  if (normalized.includes("tomorrow") || normalized.includes("daily")) {
    return "You've reached today's code request limit. Please try again tomorrow.";
  }
  if (normalized.includes("valid email")) {
    return "Please enter a valid email address.";
  }

  return message;
}

export function ResendSignIn() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) {
      setCooldownSeconds(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCooldownSeconds(diff);
      if (diff <= 0) {
        setCooldownEnd(null);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const requestOtp = async () => {
    setEmailError("");
    setStatusMessage("");
    setOtpError("");

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setEmailError(validation.error.errors[0].message);
      return;
    }

    const normalizedEmail = validation.data.email.toLowerCase();
    setEmail(normalizedEmail);

    setIsRequesting(true);

    clientLogger.debug("OTP email request", {
      page: "/",
      emailDomain: getEmailDomain(normalizedEmail),
    });

    try {
      const result = await signIn("resend", {
        email: normalizedEmail,
        redirect: false,
      });

      if (result?.error) {
        const message = mapRequestError(result.error);
        setEmailError(message);
        clientLogger.warn("OTP email request rejected", {
          page: "/",
          emailDomain: getEmailDomain(normalizedEmail),
          code: result.error,
        });
        return;
      }

      setCodeRequested(true);
      setStatusMessage(`We've sent a verification code to ${normalizedEmail}.`);
      setCooldownEnd(Date.now() + 30_000);
      clientLogger.info("OTP email sent", {
        page: "/",
        emailDomain: getEmailDomain(normalizedEmail),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? mapRequestError(error.message)
          : "We couldn't send the code. Please try again.";
      setEmailError(message);
      clientLogger.error("OTP email request failed", {
        page: "/",
        emailDomain: getEmailDomain(normalizedEmail),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestOtp();
  };

  const handleResend = async () => {
    if (isRequesting || cooldownSeconds > 0) return;
    await requestOtp();
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOtpError("");

    const validation = otpSchema.safeParse(otp);
    if (!validation.success) {
      setOtpError(validation.error.errors[0].message);
      return;
    }

    setIsVerifying(true);

    clientLogger.debug("OTP verification attempted", {
      page: "/",
      emailDomain: getEmailDomain(email),
    });

    try {
      const result = await signIn("otp", {
        email,
        otp: validation.data,
        redirect: false,
        callbackUrl: "/studies",
      });

      if (result?.error) {
        const message = mapOtpError(result.code ?? result.error);
        setOtpError(message);
        clientLogger.warn("OTP verification failed", {
          page: "/",
          emailDomain: getEmailDomain(email),
          code: result.code ?? result.error,
        });

        if (
          result.code === "otp_locked" ||
          result.code === "otp_expired" ||
          result.code === "otp_not_found"
        ) {
          setCodeRequested(false);
          setStatusMessage("");
          setOtp("");
        }
        return;
      }

      clientLogger.info("OTP verification successful", {
        page: "/",
        emailDomain: getEmailDomain(email),
      });

      const destination = result?.url ?? "/studies";
      window.location.href = destination;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't verify the code. Please try again.";
      setOtpError(message);
      clientLogger.error("OTP verification error", {
        page: "/",
        emailDomain: getEmailDomain(email),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const resetToEmailStep = () => {
    setCodeRequested(false);
    setOtp("");
    setStatusMessage("");
    setOtpError("");
    setEmailError("");
    setCooldownEnd(null);
    setCooldownSeconds(0);
  };

  if (!codeRequested) {
    return (
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="What is your email?"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError("");
          }}
          className="bg-white/80 text-black"
        />
        <Button type="submit" size="sm" disabled={isRequesting || !email}>
          {isRequesting ? "Sending code…" : "Send sign-in code"}
        </Button>
        {emailError && <p className="mt-1 text-xs">{emailError}</p>}
      </form>
    );
  }

  return (
    <div className="animate-in fade-in space-y-3 text-white duration-200">
      <div className="space-y-2">
        <p className="max-w-xs text-sm">
          Enter the verification code we sent to {email}.
        </p>
        {statusMessage && <p className="max-w-xs text-xs">{statusMessage}</p>}
        {emailError && <p className="max-w-xs text-xs text-red-200">{emailError}</p>}
      </div>

      <form onSubmit={handleVerify} className="space-y-2">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="Enter your 6 digit code"
          value={otp}
          onChange={(event) => {
            setOtp(event.target.value.replace(/[^0-9]/g, ""));
            if (otpError) setOtpError("");
          }}
          className="bg-white/80 text-black"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isVerifying || otp.length !== 6}
        >
          {isVerifying ? "Signing in…" : "Verify code"}
        </Button>
        {otpError && <p className="text-xs text-red-200">{otpError}</p>}
      </form>

      <div className="flex items-center gap-2 text-xs">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="text-black"
          disabled={isRequesting || cooldownSeconds > 0}
          onClick={handleResend}
        >
          {cooldownSeconds > 0
            ? `Resend code in ${cooldownSeconds}s`
            : "Resend code"}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-white"
          onClick={resetToEmailStep}
        >
          Use a different email
        </Button>
      </div>
    </div>
  );
}
