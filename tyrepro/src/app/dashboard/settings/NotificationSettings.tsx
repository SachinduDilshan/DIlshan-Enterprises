"use client";

import { useEffect, useState } from "react";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, CheckCircle } from "lucide-react";

interface AlertSettings {
  chequeDueIn2Days:        boolean;
  chequeOverdue:           boolean;
  lowStock:                boolean;
  ucNotSentToCEAT:         boolean;
  ceatReplacementOverdue:  boolean;
}

const DEFAULT: AlertSettings = {
  chequeDueIn2Days:       true,
  chequeOverdue:          true,
  lowStock:               true,
  ucNotSentToCEAT:        true,
  ceatReplacementOverdue: true,
};

const ALERT_ITEMS: { key: keyof AlertSettings; label: string; description: string }[] = [
  { key: "chequeDueIn2Days",       label: "Cheque due in 2 days",                  description: "Alert when a cheque matures within 48 hours"           },
  { key: "chequeOverdue",          label: "Cheque overdue",                         description: "Alert when a cheque's due date has passed"             },
  { key: "lowStock",               label: "Low stock",                              description: "Alert when any product drops below reorder level"      },
  { key: "ucNotSentToCEAT",        label: "UC tyre not sent to CEAT (3+ days)",     description: "Alert when a collected tyre sits 3+ days unsent"       },
  { key: "ceatReplacementOverdue", label: "CEAT replacement not received (30+ days)", description: "Alert when CEAT hasn't returned a tyre in 30+ days" },
];

export default function NotificationSettings() {
  const { appUser }           = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    async function load() {
      if (!appUser) return;
      const snap = await getDoc(doc(db, "alertSettings", appUser.uid));
      if (snap.exists()) setSettings({ ...DEFAULT, ...snap.data() as AlertSettings });
      setLoading(false);
    }
    load();
  }, [appUser]);

  async function handleSave() {
    if (!appUser) return;
    setSaving(true);
    await setDoc(doc(db, "alertSettings", appUser.uid), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggle(key: keyof AlertSettings) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  if (loading) return <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-800">Alert preferences</h2>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" /> Saved
          </div>
        )}
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
        These alerts run automatically every morning and are shown on your dashboard.
        Push notifications require the app to be installed on your device.
      </div>

      <Card padding={false}>
        {ALERT_ITEMS.map(({ key, label, description }, i) => (
          <div
            key={key}
            className={`flex items-center justify-between px-4 py-4 ${i < ALERT_ITEMS.length - 1 ? "border-b border-gray-50" : ""}`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0 ${settings[key] ? "bg-brand-50" : "bg-gray-100"}`}>
                <Bell className={`h-4 w-4 ${settings[key] ? "text-brand-600" : "text-gray-400"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => toggle(key)}
              className={`relative ml-4 flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${settings[key] ? "bg-brand-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${settings[key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </Card>

      <Button className="w-full" onClick={handleSave} loading={saving}>
        Save preferences
      </Button>
    </div>
  );
}