"use client";

import { useState, useEffect, useRef } from "react";

export function CountdownStopwatch() {
  const [timeLeft, setTimeLeft] = useState(60000); // 60 seconds in milliseconds
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start countdown when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            setIsRunning(true);
            setHasStarted(true);
          }
        });
      },
      { threshold: 0.5 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 10) {
            setIsRunning(false);
            return 0;
          }
          return prev - 10;
        });
      }, 10);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const handleReset = () => {
    setTimeLeft(60000);
    setIsRunning(true);
  };

  // Format time as MM:SS.ms
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);

    return {
      minutes: minutes.toString().padStart(2, "0"),
      seconds: seconds.toString().padStart(2, "0"),
      milliseconds: milliseconds.toString().padStart(2, "0"),
    };
  };

  const time = formatTime(timeLeft);

  // Calculate stroke dashoffset for the circular progress
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / 60000) * circumference;

  return (
    <div ref={containerRef} className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        {/* SVG Circle */}
        <svg width="320" height="320" className="rotate-[-90deg]">
          {/* Background circle */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-100 ease-linear"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Time display */}
        <div className="absolute flex flex-col items-center justify-center">
          <div className="flex items-baseline tracking-tight text-zinc-900 tabular-nums">
            <span className="text-6xl font-bold md:text-7xl">
              {time.minutes}
            </span>
            <span className="text-4xl font-bold md:text-5xl">:</span>
            <span className="text-6xl font-bold md:text-7xl">
              {time.seconds}
            </span>
            <span className="text-3xl font-medium text-zinc-400 md:text-4xl">
              .{time.milliseconds}
            </span>
          </div>
        </div>

        {/* Clickable overlay to restart when finished */}
        {timeLeft === 0 && (
          <div
            onClick={handleReset}
            className="absolute inset-0 cursor-pointer rounded-full"
            aria-label="Click to restart timer"
          />
        )}
      </div>
    </div>
  );
}
