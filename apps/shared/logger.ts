import pino from "pino";
import { sendToCloudWatch } from "./cloudwatchLogger";

type LogArgs = { message: string | undefined; context: Record<string, unknown> };

function normalizeLogArguments(msg: any, args: any[]): LogArgs {
  const context: Record<string, unknown> = {};
  let message: string | undefined = undefined;

  const coerceToString = (value: any) => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  };

  const mergeContext = (value: any) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(context, value);
    } else if (value !== undefined) {
      message = [message, coerceToString(value)].filter(Boolean).join(" ");
    }
  };

  if (typeof msg === "string" || typeof msg === "number" || typeof msg === "boolean") {
    message = coerceToString(msg);
  } else {
    mergeContext(msg);
  }

  args.forEach((arg) => mergeContext(arg));

  return { message, context };
}

export function createLogger(service: string) {
  // Create the base logger
  const baseLogger = pino({
    level: "debug",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label: string) {
        return { level: label.toUpperCase() };
      },

      bindings(bindings) {
        return {
          pid: bindings.pid,
          host: bindings.hostname,
        };
      },

      log(object) {
        return {
          ...object,
          service,
        };
      },
    },
  });

  const logWithCloudWatch = (
    level: "debug" | "info" | "warn" | "error",
    msg: any,
    args: any[]
  ) => {
    const { message, context } = normalizeLogArguments(msg, args);

    const hasContext = Object.keys(context).length > 0;
    const logMethod = baseLogger[level].bind(baseLogger);

    if (hasContext) {
      logMethod(context, message);
    } else {
      logMethod(message);
    }

    const shouldSendToCloudWatch = level !== "debug";
    if (!shouldSendToCloudWatch) return;

    try {
      sendToCloudWatch(
        JSON.stringify({
          level: level === "info" ? 30 : level === "warn" ? 40 : 50,
          time: Date.now(),
          msg: message,
          ...context,
        })
      );
    } catch (_) {
      // Ignore CloudWatch errors to prevent logging loops
    }
  };

  // Wrap the logger to add CloudWatch logging
  return {
    debug: (msg: any, ...args: any[]) => logWithCloudWatch("debug", msg, args),
    info: (msg: any, ...args: any[]) => logWithCloudWatch("info", msg, args),
    warn: (msg: any, ...args: any[]) => logWithCloudWatch("warn", msg, args),
    error: (msg: any, ...args: any[]) => logWithCloudWatch("error", msg, args),
  };
}

const serviceName = process.env.SERVICE_NAME || "seer-app";
export const logger = createLogger(serviceName);
