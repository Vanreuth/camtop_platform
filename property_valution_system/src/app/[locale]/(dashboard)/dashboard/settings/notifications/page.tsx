import { NotificationsSettings } from "@/components/settings/NotificationsSettings";

// Optional: Add metadata
export const metadata = {
  title: "Notification Settings",
  description: "Configure how you receive notifications",
};

export default function NotificationsSettingsPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <NotificationsSettings />
    </div>
  );
}