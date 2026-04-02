"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIF_SETTINGS_KEY,
  loadNotificationSettings,
  type NotificationSettingsDTO,
} from "@/hooks/notification/notificationSettings.storage";

const STORAGE_KEY = NOTIF_SETTINGS_KEY;
export type NotificationSettings = NotificationSettingsDTO;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

function isNowInQuietHours(start: string, end: string) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return true;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e;
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    const load = () => setSettings(loadNotificationSettings());

    load();

    // listen for changes from other tabs/pages
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) load();
    };
    const onSameTabUpdate = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("notification_settings_updated", onSameTabUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("notification_settings_updated", onSameTabUpdate);
    };
  }, []);

  const masterEnabled = settings.masterNotifications;
  const soundEnabled = settings.soundEnabled && masterEnabled;

  const quietActive =
    masterEnabled &&
    settings.quietHoursEnabled &&
    isNowInQuietHours(settings.quietHoursStart, settings.quietHoursEnd);

  return {
    settings,
    masterEnabled,
    soundEnabled,
    quietActive,
  };
}
