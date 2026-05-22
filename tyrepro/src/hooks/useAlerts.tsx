"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AlertItem {
  type:    string;
  message: string;
  count:   number;
  items:   string[];
}

interface SystemAlerts {
  alerts:      AlertItem[];
  totalCount:  number;
  generatedAt: any;
}

export function useAlerts() {
  const [data, setData]       = useState<SystemAlerts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "systemAlerts", "latest"), snap => {
      if (snap.exists()) setData(snap.data() as SystemAlerts);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { alerts: data?.alerts ?? [], totalCount: data?.totalCount ?? 0, loading };
}
