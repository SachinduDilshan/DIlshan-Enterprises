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
    const now     = new Date();
    const alerts: { type: string; message: string; count: number; items: string[] }[] = [];

    // ── Cheques due within 2 days ─────────────────────────
    const in2days = new Date(now);
    in2days.setDate(now.getDate() + 2);
    in2days.setHours(23, 59, 59, 999);

    const dueSoonSnap = await db.collection("cheques")
      .where("status", "==", "pending")
      .where("dueDate", ">=", Timestamp.fromDate(now))
      .where("dueDate", "<=", Timestamp.fromDate(in2days))
      .get();

    if (!dueSoonSnap.empty) {
      const items = dueSoonSnap.docs.map(d => {
        const c    = d.data();
        const days = Math.ceil((c.dueDate.toDate().getTime() - now.getTime()) / 86_400_000);
        return `${c.shopName} — Rs ${Number(c.amount).toLocaleString()} · #${c.chequeNo} · due in ${days}d`;
      });
      alerts.push({ type: "cheque_due_soon", message: "Cheques due within 2 days", count: dueSoonSnap.size, items });
    }

    // ── Overdue cheques ───────────────────────────────────
    const overdueSnap = await db.collection("cheques")
      .where("status", "==", "pending")
      .where("dueDate", "<", Timestamp.fromDate(now))
      .get();

    if (!overdueSnap.empty) {
      const items = overdueSnap.docs.map(d => {
        const c    = d.data();
        const days = Math.floor((now.getTime() - c.dueDate.toDate().getTime()) / 86_400_000);
        return `${c.shopName} — Rs ${Number(c.amount).toLocaleString()} · #${c.chequeNo} · ${days}d overdue`;
      });
      alerts.push({ type: "cheque_overdue", message: "Overdue cheques", count: overdueSnap.size, items });
    }

    // ── Write to Firestore for dashboard display ──────────
    const existing = await db.collection("systemAlerts").doc("latest").get();
    const prevAlerts: typeof alerts = existing.exists
      ? (existing.data()?.alerts ?? []).filter((a: any) => a.type !== "cheque_due_soon" && a.type !== "cheque_overdue")
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
    console.error("notify-cheques error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}