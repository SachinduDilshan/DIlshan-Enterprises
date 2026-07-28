"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import UserManagement from "@/app/dashboard/settings/users/UserManagement";
import NotificationSettings from "@/app/dashboard/settings/notifications/NotificationSettings";

type SettingsTab = "users" | "notifications";

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("users");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Dilshan Enterprises — system configuration</p>
      </div>

      <Tabs
        className="mb-6"
        active={tab}
        onChange={k => setTab(k as SettingsTab)}
        options={[
          { key: "users",         label: "Users"         },
          { key: "notifications", label: "Notifications" },
        ]}
      />

      {tab === "users"         && <UserManagement />}
      {tab === "notifications" && <NotificationSettings />}
    </div>
  );
}