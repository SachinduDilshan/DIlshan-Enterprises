"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Users, Bell } from "lucide-react";
import UserManagement from "./users/UserManagement";
//import NotificationSettings from "./NotificationSettings";

const TABS = [
  { key: "users",  label: "Users",         icon: Users },
  { key: "alerts", label: "Notifications", icon: Bell  },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("users");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Dilshan Enterprises — system configuration</p>
      </div>

      <div className="mb-5 flex gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "users"  && <UserManagement />}
     {/** {tab === "alerts" && <NotificationSettings />} **/}
    </div>
  );
}