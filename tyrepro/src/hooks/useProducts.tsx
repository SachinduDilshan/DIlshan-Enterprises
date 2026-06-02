"use client";

import { useEffect, useState } from "react";
import { query, onSnapshot, orderBy, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // No compound index needed — just order by name
    const q = query(collection(db, "products"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      // Treat missing `active` field as active=true (handles old/new docs)
      setProducts(all.filter(p => p.active !== false));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Also expose allProducts including inactive — useful for management screens
  return { products, loading };
}
