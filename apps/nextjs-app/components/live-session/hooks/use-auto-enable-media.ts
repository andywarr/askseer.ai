import { useRef, useEffect } from "react";
import type { LocalParticipant } from "livekit-client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Auto-enable mic + camera once when a participant first mounts.
 * Gracefully handles missing devices (e.g. no camera plugged in).
 */
export function useAutoEnableMedia(localParticipant: LocalParticipant) {
  const t = useTranslations("LiveSessionRoom");
  const didAutoEnable = useRef(false);

  useEffect(() => {
    if (didAutoEnable.current) return;
    didAutoEnable.current = true;

    (async () => {
      try {
        await localParticipant.setCameraEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Camera auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error(t("noCameraFound"));
        }
      }
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (err: any) {
        console.warn("[LiveSession] Mic auto-enable failed:", err?.message);
        if (err?.name === "NotFoundError") {
          toast.error(t("noMicrophoneFound"));
        }
      }
    })();
  }, [localParticipant, t]);
}
