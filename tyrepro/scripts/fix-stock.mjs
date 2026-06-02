/**
 * Fix corrupt stock documents where qty was stored as an object
 * (caused by increment() being used in setDoc on a new document)
 *
 * Run once:
 *   node scripts/fix-stock.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("✅ Loaded .env.local");
} catch {
  console.warn("⚠️  Could not load .env.local");
}

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

async function fixStock() {
  const snap = await db.collection("stock").get();
  let fixed = 0;
  let ok    = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const qty  = data.qty;

    if (typeof qty !== "number") {
      // qty is corrupt (object/sentinel) — reset to 0 so it can be re-added manually
      await docSnap.ref.update({ qty: 0 });
      console.log(`🔧 Fixed: ${docSnap.id} — qty was ${JSON.stringify(qty)}, reset to 0`);
      fixed++;
    } else {
      ok++;
    }
  }

  console.log(`\n✅ Done — ${fixed} fixed, ${ok} already correct`);
  if (fixed > 0) {
    console.log("\n⚠️  Affected stock records were reset to 0.");
    console.log("   Go to Inventory → Add stock to re-enter the correct quantities.");
  }
  process.exit(0);
}

fixStock().catch(err => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
