"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  Volume2,
  Clock,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettingsDTO,
} from "@/hooks/notification/notificationSettings.storage";

export const NotificationsSettings = () => {
  const [isSaving, setIsSaving] = useState(false);

  // ✅ single state object = easier to save/load
  const [settings, setSettings] = useState<NotificationSettingsDTO>(DEFAULT_NOTIFICATION_SETTINGS);

  // ✅ Load once on mount
  useEffect(() => {
    const loaded = loadNotificationSettings();
    setSettings(loaded);
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // ✅ save locally immediately (works offline)
      saveNotificationSettings(settings);

      // Optional: also send to API here
      // await notificationApi.updateSettings(settings);
      if (settings.masterNotifications && settings.soundEnabled) {
        const preview = new Audio("/sounds/notification-sound.mp3");
        preview.volume = 0.6;
        void preview.play().catch(() => {});
      }

      toast.success("Notification settings saved successfully");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setSettings(DEFAULT_NOTIFICATION_SETTINGS);
    saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    toast.success("Settings reset to defaults");
  };

  const master = settings.masterNotifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
        <p className="text-muted-foreground mt-1">
          Configure how you receive notifications across different channels.
        </p>
      </div>

      {/* Master Toggle */}
      <Card className={cn("border-2 transition-colors", master ? "border-primary/20 bg-primary/5" : "border-border")}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Master Notifications
              </CardTitle>
              <CardDescription>
                Enable or disable all notifications. This will override all other settings.
              </CardDescription>
            </div>
            <Switch checked={master} onCheckedChange={(v) => setSettings((p) => ({ ...p, masterNotifications: v }))} className="mt-1" />
          </div>
        </CardHeader>
      </Card>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Global Settings
          </CardTitle>
          <CardDescription>Configure general notification behavior</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notification Sounds</Label>
              <p className="text-sm text-muted-foreground">Play a sound when receiving notifications</p>
            </div>
            <Switch
              checked={settings.soundEnabled && master}
              onCheckedChange={(v) => setSettings((p) => ({ ...p, soundEnabled: v }))}
              disabled={!master}
            />
          </div>

          <Separator />

          {/* Quiet Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Quiet Hours
                </Label>
                <p className="text-sm text-muted-foreground">Pause non-critical notifications during specific hours</p>
              </div>
              <Switch
                checked={settings.quietHoursEnabled && master}
                onCheckedChange={(v) => setSettings((p) => ({ ...p, quietHoursEnabled: v }))}
                disabled={!master}
              />
            </div>

            {settings.quietHoursEnabled && master && (
              <div className="grid gap-4 sm:grid-cols-2 pl-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start" className="text-sm">Start Time</Label>
                  <Select value={settings.quietHoursStart} onValueChange={(v) => setSettings((p) => ({ ...p, quietHoursStart: v }))}>
                    <SelectTrigger id="quiet-start"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, "0");
                        return <SelectItem key={hour} value={`${hour}:00`}>{`${hour}:00`}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quiet-end" className="text-sm">End Time</Label>
                  <Select value={settings.quietHoursEnd} onValueChange={(v) => setSettings((p) => ({ ...p, quietHoursEnd: v }))}>
                    <SelectTrigger id="quiet-end"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, "0");
                        return <SelectItem key={hour} value={`${hour}:00`}>{`${hour}:00`}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Frequency */}
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label className="text-base">Notification Frequency</Label>
              <p className="text-sm text-muted-foreground">Choose how often you receive email notifications</p>
            </div>
            <Select
              value={settings.notificationFrequency}
              onValueChange={(v) =>
                setSettings((p) => ({ ...p, notificationFrequency: v as NotificationSettingsDTO["notificationFrequency"] }))
              }
              disabled={!master}
            >
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant (as they happen)</SelectItem>
                <SelectItem value="hourly">Hourly Digest</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex gap-3 pt-6">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">About Notification Channels</p>
            <p className="text-blue-700 dark:text-blue-300">
              <strong>Email:</strong> Notifications sent to your registered email address.
              <strong className="ml-3">Push:</strong> Browser and mobile push notifications.
              <strong className="ml-3">In-App:</strong> Notifications visible within the application.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between pt-4 border-t">
        <Button variant="outline" onClick={handleResetToDefaults} disabled={isSaving}>
          Reset to Defaults
        </Button>
        <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
