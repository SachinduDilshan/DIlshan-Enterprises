"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationItem {
  type:    string;
  message: string;
  count:   number;
  items:   string[];
}

const ALERT_ICONS: Record<string, string> = {
  cheque_due_soon: "📅",
  cheque_overdue:  "⚠️",
  low_stock:       "📦",
  out_of_stock:    "🚫",
  uc_not_sent:     "🔄",
  ceat_overdue:    "⏰",
};

const ALERT_COLORS: Record<string, string> = {
  cheque_due_soon: "text-amber-700 bg-amber-50 border-amber-200",
  cheque_overdue:  "text-red-700 bg-red-50 border-red-200",
  low_stock:       "text-amber-700 bg-amber-50 border-amber-200",
  out_of_stock:    "text-red-700 bg-red-50 border-red-200",
  uc_not_sent:     "text-orange-700 bg-orange-50 border-orange-200",
  ceat_overdue:    "text-red-700 bg-red-50 border-red-200",
};

export { ALERT_ICONS, ALERT_COLORS };

export function useNotifications() {
  const { appUser }                       = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount]       = useState(0);
  const [lastSeen, setLastSeen]           = useState<number>(0);
  const [generatedAt, setGeneratedAt]     = useState<number>(0);
  const [loading, setLoading]             = useState(true);

  // Load last-seen timestamp from localStorage
  useEffect(() => {
    if (!appUser) return;
    const stored = localStorage.getItem(`notifications_seen_${appUser.uid}`);
    if (stored) setLastSeen(parseInt(stored));
  }, [appUser?.uid]);

  // Listen to systemAlerts in real time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "systemAlerts", "latest"), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setNotifications(data.alerts ?? []);
        setTotalCount(data.totalCount ?? 0);
        const genAt = data.generatedAt?.toDate?.()?.getTime() ?? 0;
        setGeneratedAt(genAt);
      } else {
        setNotifications([]);
        setTotalCount(0);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // hasNew = alerts were generated after last time user saw them
  const hasNew = generatedAt > lastSeen && totalCount > 0;

  const markAsSeen = useCallback(() => {
    if (!appUser) return;
    const now = Date.now();
    setLastSeen(now);
    localStorage.setItem(`notifications_seen_${appUser.uid}`, String(now));
  }, [appUser?.uid]);

  // Run all alert checks
  const refreshAlerts = useCallback(async () => {
    await Promise.all([
      fetch("/api/notify-cheques"),
      fetch("/api/notify-stock"),
      fetch("/api/notify-uc"),
    ]);
  }, []);

  return { notifications, totalCount, hasNew, loading, markAsSeen, refreshAlerts };
}