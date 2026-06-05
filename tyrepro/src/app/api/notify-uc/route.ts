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
    const now    = Date.now();
    const alerts: { type: string; message: string; count: number; items: string[] }[] = [];

    // ── UC tyres not sent to CEAT (3+ days) ──────────────
    const approvedSnap = await db.collection("ucReturns")
      .where("status", "==", "approved")
      .where("tyreReceivedFromShop", "==", true)
      .get();

    const notSent = approvedSnap.docs.filter(d => {
      const data = d.data();
      if (!data.tyreReceivedAt) return false;
      const days = Math.floor((now - data.tyreReceivedAt.toDate().getTime()) / 86_400_000);
      return days >= 3;
    });

    if (notSent.length > 0) {
      const items = notSent.map(d => {
        const uc   = d.data();
        const days = Math.floor((now - uc.tyreReceivedAt.toDate().getTime()) / 86_400_000);
        return `${uc.shopName} — ${uc.productName} · with you ${days}d, not sent to CEAT`;
      });
      alerts.push({
        type:    "uc_not_sent",
        message: "UC tyres not sent to CEAT (3+ days)",
        count:   notSent.length,
        items,
      });
    }

    // ── CEAT replacement overdue (30+ days) ──────────────
    const ceatSnap = await db.collection("ucReturns")
      .where("status", "in", ["sent_to_supplier", "awaiting_replacement"])
      .get();

    const ceatOverdue = ceatSnap.docs.filter(d => {
      const data = d.data();
      if (!data.sentToSupplierAt) return false;
      const days = Math.floor((now - data.sentToSupplierAt.toDate().getTime()) / 86_400_000);
      return days >= 30;
    });

    if (ceatOverdue.length > 0) {
      const items = ceatOverdue.map(d => {
        const uc   = d.data();
        const days = Math.floor((now - uc.sentToSupplierAt.toDate().getTime()) / 86_400_000);
        return `${uc.shopName} — ${uc.productName} · sent to CEAT ${days}d ago`;
      });
      alerts.push({
        type:    "ceat_overdue",
        message: "CEAT replacement overdue (30+ days)",
        count:   ceatOverdue.length,
        items,
      });
    }

    // ── Write to Firestore ────────────────────────────────
    const existing = await db.collection("systemAlerts").doc("latest").get();
    const prevAlerts: typeof alerts = existing.exists
      ? (existing.data()?.alerts ?? []).filter((a: any) =>
          a.type !== "uc_not_sent" && a.type !== "ceat_overdue"
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
    console.error("notify-uc error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}