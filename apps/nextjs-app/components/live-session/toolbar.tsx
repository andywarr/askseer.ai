"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/apps/nextjs-app/components/ui/dropdown-menu";
import { ChevronUp } from "lucide-react";

// ─── Toolbar Button (square, icon on top, label underneath) ─────────────────

export function ToolbarButton({
  icon,
  label,
  active = false,
  disabled = false,
  variant = "ghost",
  onClick,
  devices,
  onDeviceSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: "ghost" | "secondary" | "destructive";
  onClick: () => void;
  devices?: MediaDeviceInfo[];
  onDeviceSelect?: (deviceId: string) => void;
}) {
  const t = useTranslations("LiveSessionRoom");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] transition-all active:scale-95 ${disabled ? "cursor-not-allowed opacity-40" : ""} ${
          variant === "destructive"
            ? "bg-red-500 text-white shadow-xs hover:bg-red-600 active:bg-red-700"
            : variant === "secondary" || active
              ? "bg-zinc-700 text-zinc-100 shadow-xs hover:bg-zinc-600 active:bg-zinc-500"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700"
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>

      {/* Device selector caret */}
      {devices && devices.length > 0 && onDeviceSelect && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="min-w-[200px]"
          >
            {devices.map((d) => (
              <DropdownMenuItem
                key={d.deviceId}
                onClick={() => onDeviceSelect(d.deviceId)}
              >
                <span className="truncate text-xs">
                  {d.label || t("deviceLabel", { id: d.deviceId.slice(0, 8) })}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Hook: list available media devices ─────────────────────────────────────

export function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    async function enumerate() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      } catch {
        // Permission not granted yet — devices will be empty
      }
    }
    enumerate();
    navigator.mediaDevices?.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", enumerate);
    };
  }, []);

  return { videoDevices, audioDevices };
}
