import { sendToCloudWatch } from "./cloudwatchLogger.ts";

interface TransportOptions {
  level: string;
}

export default async function (
  _opts: TransportOptions
): Promise<{ write: (msg: string) => void }> {
  return {
    write: (msg: string) => {
      sendToCloudWatch(msg);
    },
  };
}
