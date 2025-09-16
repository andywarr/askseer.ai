import { handlers, verificationTokenIssuedAt } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

// Explicit HEAD handler so email security scanners issuing HEAD requests
// don't trigger the NextAuth GET logic (which could consume single-use tokens).
export const HEAD = async () => new Response(null, { status: 200 });

// Keep original handlers so we can wrap GET selectively.
// Type cast to any to avoid mismatches if NextAuth's handler expects NextRequest.
const originalGET: any = handlers.GET;
export const POST = handlers.POST;

// Known / likely email security scanner UA substrings. Keep list small & conservative.
const SCANNER_UA_PATTERNS: RegExp[] = [
  /proofpoint/i,
  /barracuda/i,
  /mimecast/i,
  /safelinks/i, // Outlook Safe Links
  /symantec/i,
  /trendmicro/i,
  /urlscan/i,
  /sandbox/i,
];

// Optional opt-out via env (set AUTH_DISABLE_SCANNER_WRAP=1 to disable logic)
const DISABLED = process.env.AUTH_DISABLE_SCANNER_WRAP === "1";

export const GET = async (req: Request) => {
  if (DISABLED) return originalGET(req);

  const ua = req.headers.get("user-agent") || "";
  // Only attempt to short-circuit for the email callback route; let other auth routes pass through.
  const url = new URL(req.url);
  const isEmailCallback = /\/api\/auth\/callback\/email$/.test(url.pathname);

  if (isEmailCallback) {
    const looksLikeScanner = SCANNER_UA_PATTERNS.some((r) => r.test(ua));

    // Extract raw token param (NextAuth uses 'token' for email provider callback)
    const tokenParam = url.searchParams.get("token");
    let earlyAccess = false;
    if (tokenParam) {
      const issuedAt = verificationTokenIssuedAt.get(tokenParam);
      if (issuedAt) {
        const ageMs = Date.now() - issuedAt;
        const threshold = parseInt(process.env.AUTH_SCANNER_EARLY_MS || "1000", 10);
        earlyAccess = ageMs >= 0 && ageMs < threshold;
        if (earlyAccess) {
          logger.info("Bypassed NextAuth email callback for very-early access", {
            ua,
            path: url.pathname,
            ageMs,
            threshold,
          });
        }
      }
    }

    if (looksLikeScanner || earlyAccess) {
      if (looksLikeScanner && !earlyAccess) {
        logger.info(
          "Bypassed NextAuth email callback for suspected scanner HEAD/GET",
          {
            ua,
            path: url.pathname,
          },
        );
      }
      return new Response(null, { status: 200 });
    }
  }

  return originalGET(req);
};
