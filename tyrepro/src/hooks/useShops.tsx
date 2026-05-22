"use client";

import { useEffect, useState } from "react";
import { query, onSnapshot, orderBy, where } from "firebase/firestore";
import { shopsCol } from "@/lib/firestore-collections";
import type { Shop } from "@/types";

export function useShops(activeOnly = true) {
  const [shops, setShops]     = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const q = activeOnly
      ? query(shopsCol, where("active", "==", true), orderBy("name"))
      : query(shopsCol, orderBy("name"));

    const unsub = onSnapshot(q,
      (snap) => {
        setShops(
          snap.docs.map(d => {
            const data = d.data() as Omit<Shop, "id">;
            return { ...data, id: d.id };
          })
        );
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [activeOnly]);

  return { shops, loading, error };
}
