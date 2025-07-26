import { pino } from "pino";
import { sendToCloudWatch } from "./cloudwatchLogger";

// Create the base logger
const baseLogger = pino({
  level: "debug",
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

// Wrap the logger to add CloudWatch logging
export const logger = {
  debug: (msg: any, ...args: any[]) => {
    baseLogger.debug(msg, ...args);
  },
  info: (msg: any, ...args: any[]) => {
    baseLogger.info(msg, ...args);
    // Send to CloudWatch for info and above
    try {
      const logString = typeof msg === "string" ? msg : JSON.stringify(msg);
      sendToCloudWatch(
        JSON.stringify({
          level: 30, // info level
          time: Date.now(),
          msg: logString,
          ...args,
        }),
      );
    } catch (error) {
      // Ignore CloudWatch errors to prevent logging loops
    }
  },
  warn: (msg: any, ...args: any[]) => {
    baseLogger.warn(msg, ...args);
    // Send to CloudWatch
    try {
      const logString = typeof msg === "string" ? msg : JSON.stringify(msg);
      sendToCloudWatch(
        JSON.stringify({
          level: 40, // warn level
          time: Date.now(),
          msg: logString,
          ...args,
        }),
      );
    } catch (error) {
      // Ignore CloudWatch errors
    }
  },
  error: (msg: any, ...args: any[]) => {
    baseLogger.error(msg, ...args);
    // Send to CloudWatch
    try {
      const logString = typeof msg === "string" ? msg : JSON.stringify(msg);
      sendToCloudWatch(
        JSON.stringify({
          level: 50, // error level
          time: Date.now(),
          msg: logString,
          ...args,
        }),
      );
    } catch (error) {
      // Ignore CloudWatch errors
    }
  },
};
