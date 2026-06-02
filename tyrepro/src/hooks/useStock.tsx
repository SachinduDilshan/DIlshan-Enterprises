"use client";

import { useEffect, useState } from "react";
import { query, where, onSnapshot, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Stock } from "@/types";

interface UseStockOptions {
  warehouseId?: string;
}

export function useStock({ warehouseId }: UseStockOptions = {}) {
  const [stock, setStock]     = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const q = warehouseId
      ? query(collection(db, "stock"), where("warehouseId", "==", warehouseId))
      : query(collection(db, "stock"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            // Ensure qty is always a plain number — guards against
            // increment() sentinel being stored instead of a real number
            qty: typeof data.qty === "number" ? data.qty : 0,
            reorderLevel: typeof data.reorderLevel === "number" ? data.reorderLevel : 10,
          } as Stock;
        });

        // Sort: low stock first, then alphabetically
        items.sort((a, b) => {
          const aLow = a.qty <= a.reorderLevel;
          const bLow = b.qty <= b.reorderLevel;
          if (aLow !== bLow) return aLow ? -1 : 1;
          return a.productName.localeCompare(b.productName);
        });

        setStock(items);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [warehouseId]);

  const lowStockItems = stock.filter(s => s.qty <= s.reorderLevel);
  return { stock, lowStockItems, loading, error };
}
