"use client";

import { useEffect, useState } from "react";
import { query, onSnapshot, where, orderBy } from "firebase/firestore";
import { productsCol } from "@/lib/firestore-collections";
import type { Product } from "@/types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const q = query(productsCol, where("active", "==", true), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(
        snap.docs.map((d) => {
          const data = d.data();
          return ({ id: d.id, ...(data as Omit<Product, "id">) } as Product);
        })
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  return { products, loading };
}
