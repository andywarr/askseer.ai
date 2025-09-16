import { handlers } from "@/apps/nextjs-app/auth";

export const HEAD = async () => new Response(null, { status: 200 });
export const { GET, POST } = handlers;
