import { handlers } from "@/apps/nextjs-app/auth";
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
    if (looksLikeScanner) {
      logger.info(
        "Bypassed NextAuth email callback for suspected scanner HEAD/GET",
        {
          ua,
          path: url.pathname,
        },
      );
      // Return 200 with no body so scanners mark link as reachable but token not consumed.
      return new Response(null, { status: 200 });
    }
  }

  return originalGET(req);
};
