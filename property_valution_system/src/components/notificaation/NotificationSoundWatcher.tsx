"use client";

import { useEffect, useRef } from "react";
import { useNotificationSound } from "@/hooks/notification/useNotificationSound";
import { useUnreadCount } from "@/hooks/notification/useNotification";
import { useNotificationSettings } from "@/hooks/notification/useNotificationSettings";

export function NotificationSoundWatcher() {
  const { masterEnabled, soundEnabled, quietActive } = useNotificationSettings();

  const { enabled: unlocked, enable: unlock, play } = useNotificationSound(
    [{ src: "/sounds/notification-sound.mp3", type: "audio/mpeg" }],
    0.6
  );

  const unreadQuery = useUnreadCount({
    enabled: masterEnabled && soundEnabled,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const raw = unreadQuery.data as unknown;
  const unreadCount =
    typeof raw === "number"
      ? raw
      : Number(
          (raw as { data?: { count?: number }; count?: number } | undefined)?.data?.count ??
            (raw as { data?: { count?: number }; count?: number } | undefined)?.count ??
            0
        );

  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!masterEnabled) return;
    if (!soundEnabled) return;
    if (quietActive) return;

    if (lastRef.current === null) {
      lastRef.current = unreadCount;
      return;
    }

    if (unreadCount > lastRef.current && unlocked) {
      play();
    }

    lastRef.current = unreadCount;
  }, [unreadCount, masterEnabled, soundEnabled, quietActive, unlocked, play]);

  useEffect(() => {
    if (!masterEnabled || !soundEnabled || unlocked) return;

    const handleInteraction = async () => {
      const ok = await unlock();
      if (!ok) return;
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    // Keep listening until audio unlock succeeds.
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [masterEnabled, soundEnabled, unlocked, unlock]);

  return null;
}
