import { NextRequest, NextResponse } from "next/server";

async function getAdmin() {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore, Timestamp }      = await import("firebase-admin/firestore");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  }
  return { db: getFirestore(), Timestamp };
}

export async function GET(req: NextRequest) {
  try {
    const { db, Timestamp } = await getAdmin();
    const alerts: { type: string; message: string; count: number; items: string[] }[] = [];

    // ── Low stock ─────────────────────────────────────────
    const stockSnap = await db.collection("stock").get();
    const lowStock  = stockSnap.docs
      .map(d => d.data())
      .filter(s => {
        const qty    = typeof s.qty === "number" ? s.qty : 0;
        const reorder = typeof s.reorderLevel === "number" ? s.reorderLevel : 10;
        return qty <= reorder;
      });

    const outOfStock = lowStock.filter(s => (typeof s.qty === "number" ? s.qty : 0) === 0);
    const low        = lowStock.filter(s => (typeof s.qty === "number" ? s.qty : 0) > 0);

    if (outOfStock.length > 0) {
      alerts.push({
        type:    "out_of_stock",
        message: "Products out of stock",
        count:   outOfStock.length,
        items:   outOfStock.map(s => `${s.productName} — ${s.warehouseName}: 0 units`),
      });
    }

    if (low.length > 0) {
      alerts.push({
        type:    "low_stock",
        message: "Low stock items",
        count:   low.length,
        items:   low.map(s =>
          `${s.productName} — ${s.warehouseName}: ${s.qty} units (min ${s.reorderLevel})`
        ),
      });
    }

    // ── Write to Firestore ────────────────────────────────
    const existing = await db.collection("systemAlerts").doc("latest").get();
    const prevAlerts: typeof alerts = existing.exists
      ? (existing.data()?.alerts ?? []).filter((a: any) =>
          a.type !== "low_stock" && a.type !== "out_of_stock"
        )
      : [];

    const mergedAlerts = [...prevAlerts, ...alerts];
    await db.collection("systemAlerts").doc("latest").set({
      alerts:      mergedAlerts,
      totalCount:  mergedAlerts.reduce((s: number, a: any) => s + a.count, 0),
      generatedAt: Timestamp.now(),
    }, { merge: true });

    return NextResponse.json({
      success:     true,
      alertsFound: alerts.length,
      alerts,
    });
  } catch (err: any) {
    console.error("notify-stock error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}