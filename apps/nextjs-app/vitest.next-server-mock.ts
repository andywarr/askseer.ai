// Mock for next/server module in tests
// This file is aliased in vitest.config.ts to replace "next/server" imports

export class NextRequest extends Request {
  nextUrl: URL;
  cookies: Map<string, string>;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    this.cookies = new Map();
  }
}

export class NextResponse extends Response {
  static json(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        ...init?.headers,
        "content-type": "application/json",
      },
    });
  }

  static redirect(url: string | URL, status?: number) {
    return new Response(null, {
      status: status || 307,
      headers: { Location: url.toString() },
    });
  }

  static next() {
    return new Response(null);
  }

  static rewrite(destination: string | URL) {
    return new Response(null, {
      headers: { "x-middleware-rewrite": destination.toString() },
    });
  }
}

export const cookies = () => ({
  get: () => undefined,
  set: () => {},
  delete: () => {},
  has: () => false,
  getAll: () => [],
});

export const headers = () => new Headers();
