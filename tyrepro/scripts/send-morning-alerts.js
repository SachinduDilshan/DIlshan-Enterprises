// Run manually during development:
// node scripts/send-morning-alerts.js

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function run() {
  console.log("Running morning alerts...");

  console.log("→ Checking cheques...");
  const c = await fetch(`${BASE_URL}/api/notify-cheques`);
  console.log("  Cheques:", (await c.json()).alertsFound, "alerts");

  console.log("→ Checking stock...");
  const s = await fetch(`${BASE_URL}/api/notify-stock`);
  console.log("  Stock:", (await s.json()).alertsFound, "alerts");

  console.log("→ Checking UC returns...");
  const u = await fetch(`${BASE_URL}/api/notify-uc`);
  console.log("  UC:", (await u.json()).alertsFound, "alerts");

  console.log("→ Sending emails...");
  const e = await fetch(`${BASE_URL}/api/send-notification-email`, { method: "POST" });
  const ed = await e.json();
  console.log(`  Emails sent: ${ed.emailsSent}`);
  if (ed.errors?.length) console.log("  Errors:", ed.errors);

  console.log("Done.");
}

run().catch(console.error);