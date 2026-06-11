import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "./proxy";
import { NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => vi.fn(() => "intl-middleware-response")),
}));

vi.mock("next/server", () => {
  const redirectMock = vi.fn((url) => ({
    type: "redirect",
    url: url.toString(),
  }));
  return {
    NextResponse: {
      redirect: redirectMock,
      next: vi.fn(() => ({ type: "next" })),
    },
  };
});

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (pathname: string, cookies: Record<string, string> = {}) => {
    const nextUrl = new URL(`http://localhost:3000${pathname}`);
    return {
      nextUrl,
      url: nextUrl.toString(),
      cookies: {
        get: (name: string) => {
          if (cookies[name]) {
            return { value: cookies[name] };
          }
          return undefined;
        },
      },
    } as any;
  };

  it("should pass non-protected route to next-intl middleware directly", () => {
    const req = createMockRequest("/about");
    const res = proxy(req);
    expect(res).toBe("intl-middleware-response");
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("should pass protected route to next-intl middleware if authenticated", () => {
    const req = createMockRequest("/studies", {
      "authjs.session-token": "valid-session",
    });
    const res = proxy(req);
    expect(res).toBe("intl-middleware-response");
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("should redirect unauthenticated protected route to signin", () => {
    const req = createMockRequest("/studies");
    proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = new URL(vi.mocked(NextResponse.redirect).mock.calls[0][0].toString());
    expect(redirectUrl.toString()).toContain("/signin");
    expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/studies");
  });

  it("should recognize locale-prefixed protected routes (e.g. /de/studies) and redirect unauthenticated to locale-prefixed signin", () => {
    const req = createMockRequest("/de/studies");
    proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = new URL(vi.mocked(NextResponse.redirect).mock.calls[0][0].toString());
    expect(redirectUrl.toString()).toContain("/de/signin");
    expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/de/studies");
  });

  it("should recognize Spanish locale-prefixed protected routes (e.g. /es/account) and redirect unauthenticated to Spanish signin", () => {
    const req = createMockRequest("/es/account");
    proxy(req);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = new URL(vi.mocked(NextResponse.redirect).mock.calls[0][0].toString());
    expect(redirectUrl.toString()).toContain("/es/signin");
    expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/es/account");
  });

  it("should allow authenticated requests on Spanish locale-prefixed protected routes", () => {
    const req = createMockRequest("/es/account", {
      "__Secure-authjs.session-token": "secure-session",
    });
    const res = proxy(req);
    expect(res).toBe("intl-middleware-response");
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});
