import { handlers } from "@/apps/nextjs-app/auth";

// Explicit HEAD handler so email security scanners issuing HEAD requests
export const HEAD = async () => new Response(null, { status: 200 });

export const { GET, POST } = handlers;
