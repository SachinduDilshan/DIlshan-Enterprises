"use client";

import { useState } from "react";
import { Bell, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import UserManagement from "@/app/dashboard/settings/users/UserManagement";
import NotificationSettings from "@/app/dashboard/settings/notifications/NotificationSettings";

type SettingsTab = "users" | "notifications";

const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: "users",         label: "Users",         icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell  },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("users");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Settings"
        description="Staff accounts and email alert preferences"
      />

      <div className="mb-6 border-b border-gray-200">
        <div role="tablist" aria-label="Settings sections" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-600 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "users" && <UserManagement />}
        {tab === "notifications" && <NotificationSettings />}
      </div>
    </div>
  );
}