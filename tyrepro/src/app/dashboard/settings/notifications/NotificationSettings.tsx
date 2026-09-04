"use client";

import { useEffect, useState } from "react";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CalendarClock, Package, RotateCcw, AlertTriangle, Bell, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertPref {
  type:    string;
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  color:   string;
  roles:   string[]; // which roles see this
}

const ALERT_PREFS: AlertPref[] = [
  {
    type:  "cheque_due_soon",
    label: "Cheque due in 2 days",
    desc:  "Alert when a cheque matures within 48 hours",
    icon:  CalendarClock,
    color: "text-amber-600 bg-amber-50",
    roles: ["admin"],
  },
  {
    type:  "cheque_overdue",
    label: "Cheque overdue",
    desc:  "Alert when a cheque's due date has passed",
    icon:  AlertTriangle,
    color: "text-red-600 bg-red-50",
    roles: ["admin"],
  },
  {
    type:  "low_stock",
    label: "Low stock",
    desc:  "Alert when any product drops below reorder level",
    icon:  Package,
    color: "text-amber-600 bg-amber-50",
    roles: ["admin", "sales_rep"],
  },
  {
    type:  "out_of_stock",
    label: "Out of stock",
    desc:  "Alert when a product has zero units",
    icon:  Package,
    color: "text-red-600 bg-red-50",
    roles: ["admin", "sales_rep"],
  },
  {
    type:  "uc_not_sent",
    label: "UC tyre not sent to CEAT (3+ days)",
    desc:  "Alert when a collected tyre sits 3+ days unsent",
    icon:  RotateCcw,
    color: "text-orange-600 bg-orange-50",
    roles: ["admin", "sales_rep"],
  },
  {
    type:  "ceat_overdue",
    label: "CEAT replacement not received (30+ days)",
    desc:  "Alert when CEAT hasn't returned a tyre in 30+ days",
    icon:  RotateCcw,
    color: "text-red-600 bg-red-50",
    roles: ["admin", "sales_rep"],
  },
];

// Toggle switch component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-brand-700" : "bg-gray-200"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  );
}

export default function NotificationSettings() {
  const { appUser } = useAuth();
  const [prefs, setPrefs]   = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult]   = useState<string | null>(null);

  const role = appUser?.role ?? "sales_rep";

  // Load preferences from Firestore
  useEffect(() => {
    if (!appUser?.uid) return;
    async function load() {
      const snap = await getDoc(doc(db, "alertSettings", appUser!.uid));
      if (snap.exists()) {
        setPrefs(snap.data() as Record<string, boolean>);
      } else {
        // Default all to true
        const defaults: Record<string, boolean> = {};
        ALERT_PREFS.forEach(p => { defaults[`notify_${p.type}`] = true; });
        setPrefs(defaults);
      }
      setLoading(false);
    }
    load();
  }, [appUser?.uid]);

  function getPref(type: string): boolean {
    const key = `notify_${type}`;
    return prefs[key] !== false; // default true if not set
  }

  function setPref(type: string, val: boolean) {
    setPrefs(prev => ({ ...prev, [`notify_${type}`]: val }));
    setSaved(false);
  }

  async function handleSave() {
    if (!appUser?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "alertSettings", appUser.uid), {
        ...prefs,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestSending(true);
    setTestResult(null);
    try {
      const res  = await fetch("/api/send-notification-email", { method: "POST" });
      const data = await res.json();
      if (data.emailsSent > 0) {
        setTestResult(`✓ Test email sent to ${data.emailsSent} user${data.emailsSent > 1 ? "s" : ""}`);
      } else {
        setTestResult("No emails sent — no active alerts or all alerts are disabled");
      }
    } catch {
      setTestResult("Failed to send test email");
    } finally {
      setTestSending(false);
    }
  }

  // Visible prefs based on role
  const visiblePrefs = ALERT_PREFS.filter(p => p.roles.includes(role));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-base font-medium text-gray-900">Alert preferences</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Choose which alerts you receive. Email notifications are sent every morning at 7 AM.
        </p>
      </div>

      {/* Role notice */}
      {role === "sales_rep" && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <strong>Sales rep:</strong> cheque alerts are only available to admin users.
        </div>
      )}

      {/* Alert toggles */}
      <Card padding={false}>
        {visiblePrefs.map((pref, i) => {
          const Icon = pref.icon;
          return (
            <div key={pref.type}
              className={cn(
                "flex items-center gap-3 px-4 py-4",
                i < visiblePrefs.length - 1 && "border-b border-gray-50"
              )}>
              <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", pref.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pref.desc}</p>
              </div>
              <Toggle
                checked={getPref(pref.type)}
                onChange={v => setPref(pref.type, v)}
              />
            </div>
          );
        })}
      </Card>

      {/* Email info */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 flex-shrink-0">
            <Mail className="h-4 w-4 text-brand-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Email delivery</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Alerts are sent to <span className="font-medium text-gray-700">{appUser?.email}</span> every morning at 7 AM.
              Only active alerts are included. If everything is clear, no email is sent.
            </p>
          </div>
        </div>

        {/* Test email — admin only */}
        {role === "admin" && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">Send a test email now with current alerts</p>
              <Button
                size="sm"
                variant="secondary"
                loading={testSending}
                onClick={handleTestEmail}
                className="gap-1.5"
              >
                <Bell className="h-3.5 w-3.5" />
                Send test email
              </Button>
            </div>
            {testResult && (
              <p className={cn(
                "mt-2 text-xs",
                testResult.startsWith("✓") ? "text-green-700" : "text-red-600"
              )}>
                {testResult}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          className="flex-1 sm:flex-none sm:w-48"
          onClick={handleSave}
          loading={saving}
        >
          {saved ? "✓ Saved" : "Save preferences"}
        </Button>
        {saved && <p className="text-sm text-green-700">Preferences updated</p>}
      </div>
    </div>
  );
}