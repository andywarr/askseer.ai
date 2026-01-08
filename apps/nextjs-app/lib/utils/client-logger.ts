/**
 * Client-side logging utility for logged-out pages
 * Sends logs to the server-side logging infrastructure
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogData {
  [key: string]: any;
}

export const clientLogger = {
  debug: (message: string, data?: LogData) =>
    logToServer("debug", message, data),
  info: (message: string, data?: LogData) => logToServer("info", message, data),
  warn: (message: string, data?: LogData) => logToServer("warn", message, data),
  error: (message: string, data?: LogData) =>
    logToServer("error", message, data),
};

async function logToServer(level: LogLevel, message: string, data?: LogData) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        message,
        data: {
          timestamp: new Date().toISOString(),
          ...data,
        },
      }),
    });
  } catch (error) {
    // Silently fail if logging fails - don't break user experience
    console.warn("Client logging failed:", error);
  }
}

/**
 * Helper function to safely extract email domain
 */
export function getEmailDomain(email: string): string {
  try {
    return email.split("@")[1] || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Common page view logging for client components
 */
export function logPageView(page: string, additionalData?: LogData) {
  clientLogger.info("Page viewed", {
    page,
    userAgent: navigator.userAgent,
    ...additionalData,
  });
}
