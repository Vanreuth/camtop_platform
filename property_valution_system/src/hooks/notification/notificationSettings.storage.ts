export const NOTIF_SETTINGS_KEY = "notification_settings_v1";

export type NotificationSettingsDTO = {
  masterNotifications: boolean;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationFrequency: "instant" | "hourly" | "daily" | "weekly";
  categories: Array<{
    id: string;
    channels: { email: boolean; push: boolean; inApp: boolean };
  }>;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsDTO = {
  masterNotifications: true,
  soundEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  notificationFrequency: "instant",
  categories: [
    { id: "property", channels: { email: true, push: true, inApp: true } },
    { id: "valuations", channels: { email: true, push: true, inApp: true } },
    { id: "payments", channels: { email: true, push: true, inApp: true } },
    { id: "messages", channels: { email: true, push: false, inApp: true } },
    { id: "security", channels: { email: true, push: true, inApp: true } },
    { id: "system", channels: { email: false, push: false, inApp: true } },
    { id: "marketing", channels: { email: false, push: false, inApp: false } },
  ],
};

function normalizeCategoryId(id: string) {
  return id === "properties" ? "property" : id;
}

function mergeCategories(parsedCategories: unknown): NotificationSettingsDTO["categories"] {
  const map = new Map<string, NotificationSettingsDTO["categories"][number]>();

  for (const category of DEFAULT_NOTIFICATION_SETTINGS.categories) {
    map.set(normalizeCategoryId(category.id), category);
  }

  if (Array.isArray(parsedCategories)) {
    for (const item of parsedCategories) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Partial<NotificationSettingsDTO["categories"][number]>;
      if (typeof candidate.id !== "string") continue;
      const id = normalizeCategoryId(candidate.id);
      const base = map.get(id) ?? {
        id,
        channels: { email: false, push: false, inApp: true },
      };

      map.set(id, {
        id,
        channels: {
          email: candidate.channels?.email ?? base.channels.email,
          push: candidate.channels?.push ?? base.channels.push,
          inApp: candidate.channels?.inApp ?? base.channels.inApp,
        },
      });
    }
  }

  return Array.from(map.values());
}

export function loadNotificationSettings(): NotificationSettingsDTO {
  try {
    const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NotificationSettingsDTO>;
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
      categories: mergeCategories(parsed?.categories),
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettingsDTO) {
  localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));

  // ✅ same-tab broadcast (Topbar / dropdown updates immediately)
  window.dispatchEvent(new Event("notification_settings_updated"));
}
