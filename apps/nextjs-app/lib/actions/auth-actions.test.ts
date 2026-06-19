import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { signOutServerAction, googleSignInServerAction } from "./auth-actions";
import { auth, signIn, signOut } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

vi.mock("@/apps/nextjs-app/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/apps/shared/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("auth-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signOutServerAction", () => {
    it("should sign out successfully and log when no redirect happens", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "test-user-id" } });
      (signOut as Mock).mockResolvedValue(undefined);

      await signOutServerAction();

      expect(auth).toHaveBeenCalled();
      expect(signOut).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("User signed out successfully", {
        userId: "test-user-id",
      });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should handle failed auth session cleanly and still sign out", async () => {
      (auth as Mock).mockRejectedValue(new Error("Auth failed"));
      (signOut as Mock).mockResolvedValue(undefined);

      await signOutServerAction();

      expect(logger.warn).toHaveBeenCalledWith("Failed to get session during sign out", expect.any(Object));
      expect(signOut).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("User signed out successfully", {
        userId: undefined,
      });
    });

    it("should log info and rethrow NEXT_REDIRECT error when signOut redirects", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "test-user-id" } });
      const redirectError = new Error("NEXT_REDIRECT");
      (signOut as Mock).mockRejectedValue(redirectError);

      await expect(signOutServerAction()).rejects.toThrow("NEXT_REDIRECT");

      expect(logger.info).toHaveBeenCalledWith("User signed out successfully", {
        userId: "test-user-id",
      });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should log error and rethrow when a real error happens in signOut", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "test-user-id" } });
      const realError = new Error("Database failure");
      (signOut as Mock).mockRejectedValue(realError);

      await expect(signOutServerAction()).rejects.toThrow("Database failure");

      expect(logger.info).not.toHaveBeenCalledWith("User signed out successfully", expect.any(Object));
      expect(logger.error).toHaveBeenCalledWith("Error during sign out", expect.objectContaining({
        userId: "test-user-id",
        error: "Database failure",
      }));
    });
  });

  describe("googleSignInServerAction", () => {
    it("should rethrow NEXT_REDIRECT when signIn redirects", async () => {
      const mockFormData = new FormData();
      mockFormData.append("redirectTo", "/custom-path");
      
      const redirectError = new Error("NEXT_REDIRECT");
      (signIn as Mock).mockRejectedValue(redirectError);

      await expect(googleSignInServerAction(mockFormData)).rejects.toThrow("NEXT_REDIRECT");

      expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/custom-path" });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should log error and rethrow when a real error happens in signIn", async () => {
      const mockFormData = new FormData();
      const realError = new Error("OAuth configuration missing");
      (signIn as Mock).mockRejectedValue(realError);

      await expect(googleSignInServerAction(mockFormData)).rejects.toThrow("OAuth configuration missing");

      expect(logger.error).toHaveBeenCalledWith("Google sign-in failed", expect.objectContaining({
        error: "OAuth configuration missing",
      }));
    });
  });
});
