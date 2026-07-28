import { NextRequest, NextResponse } from "next/server";

async function getAdmin() {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore }                 = await import("firebase-admin/firestore");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  }
  return { db: getFirestore() };
}

// Email via Gmail SMTP using Nodemailer
async function sendEmail(to: string, subject: string, html: string) {
  const nodemailerPackage = "nodemailer";
  const nodemailer = await import(nodemailerPackage);
  const transporter = nodemailer.default.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
  });
  await transporter.sendMail({
    from:    `"TyrePro — Dilshan Enterprises" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

function buildEmailHtml(alerts: { type: string; message: string; count: number; items: string[] }[]) {
  const alertRows = alerts.map(a => `
    <div style="margin-bottom:16px;padding:14px 16px;border-radius:8px;background:#f9f9f9;border-left:4px solid #4338CA">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#1a1a1a">${a.count} × ${a.message}</p>
      <ul style="margin:0;padding-left:18px">
        ${a.items.map(i => `<li style="font-size:13px;color:#555;margin-bottom:3px">${i}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4">
      <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
        <div style="background:#3730A3;padding:24px 28px">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">Dilshan Enterprises</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px">TyrePro — Daily Alert Summary</p>
        </div>
        <div style="padding:24px 28px">
          <p style="margin:0 0 20px;font-size:14px;color:#444">
            The following alerts were generated for your account. Please review and take action as needed.
          </p>
          ${alertRows}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard"
               style="display:inline-block;background:#4338CA;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500">
              Open dashboard →
            </a>
          </div>
        </div>
        <div style="padding:16px 28px;background:#f9f9f9;border-top:1px solid #eee">
          <p style="margin:0;font-size:12px;color:#999">
            This is an automated alert from TyrePro. Generated at ${new Date().toLocaleString("en-LK")}.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { db } = await getAdmin();

    // Load all alerts
    const alertsSnap = await db.collection("systemAlerts").doc("latest").get();
    if (!alertsSnap.exists) {
      return NextResponse.json({ message: "No alerts to send" });
    }
    const allAlerts: { type: string; message: string; count: number; items: string[] }[] =
      alertsSnap.data()?.alerts ?? [];

    if (allAlerts.length === 0) {
      return NextResponse.json({ message: "No active alerts" });
    }

    // Cheque alert types
    const CHEQUE_ALERT_TYPES = ["cheque_due_soon", "cheque_overdue"];

    // Load all users
    const usersSnap = await db.collection("users").where("active", "==", true).get();
    let emailsSent  = 0;
    const errors: string[] = [];

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      const { role, email, displayName, uid } = user;

      // Drivers never get emails
      if (role === "driver" || !email) continue;

      // Load user's notification preferences
      const prefSnap  = await db.collection("alertSettings").doc(uid).get();
      const prefs     = prefSnap.exists ? prefSnap.data() ?? {} : {};

      // Build alerts for this user based on role + preferences
      let userAlerts = allAlerts.filter(a => {
        // Sales rep never gets cheque alerts
        if (role === "sales_rep" && CHEQUE_ALERT_TYPES.includes(a.type)) return false;

        // Check if user has disabled this alert type
        const prefKey = `notify_${a.type}`;
        if (prefs[prefKey] === false) return false;

        return true;
      });

      if (userAlerts.length === 0) continue;

      try {
        const subject = `TyrePro alert: ${userAlerts.length} item${userAlerts.length > 1 ? "s" : ""} need attention`;
        const html    = buildEmailHtml(userAlerts);
        await sendEmail(email, subject, html);
        emailsSent++;

        // Log that email was sent
        await db.collection("emailLogs").add({
          to:        email,
          uid,
          role,
          alertCount: userAlerts.length,
          alertTypes: userAlerts.map(a => a.type),
          sentAt:    new Date(),
        });
      } catch (err: any) {
        errors.push(`${email}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, emailsSent, errors });
  } catch (err: any) {
    console.error("send-notification-email error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}