"use client";

import { useEffect, useState } from "react";
import { query, where, onSnapshot, orderBy } from "firebase/firestore";
import { stockCol } from "@/lib/firestore-collections";
import type { Stock } from "@/types";

interface UseStockOptions {
  warehouseId?: string; // filter to one warehouse; undefined = all
}

export function useStock({ warehouseId }: UseStockOptions = {}) {
  const [stock, setStock] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q = warehouseId
      ? query(stockCol, where("warehouseId", "==", warehouseId))
      : query(stockCol);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Stock));
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

  const lowStockItems = stock.filter((s) => s.qty <= s.reorderLevel);

  return { stock, lowStockItems, loading, error };
}
