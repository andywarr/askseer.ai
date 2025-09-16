import { handlers } from "@/apps/nextjs-app/auth";

// Explicit HEAD handler so email security scanners issuing HEAD requests
// don't trigger the NextAuth GET logic (which could consume single-use tokens).
export const HEAD = async () => new Response(null, { status: 200 });

export const { GET, POST } = handlers;
