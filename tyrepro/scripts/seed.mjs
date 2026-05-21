/**
 * Firestore seed script — run ONCE to set up initial data
 * Usage: node scripts/seed.mjs
 */

// Load .env.local automatically — no extra packages needed (Node 20+)
import { readFileSync } from "fs";
import { resolve } from "path";

// Manually parse .env.local (works without dotenv package)
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
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
  console.warn("⚠️  Could not load .env.local — using system environment variables");
}

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing Firebase Admin credentials in .env.local");
  console.error("   Make sure these are set:");
  console.error("   FIREBASE_ADMIN_PROJECT_ID");
  console.error("   FIREBASE_ADMIN_CLIENT_EMAIL");
  console.error("   FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db   = getFirestore();
const auth = getAuth();

// ── 1. Warehouses ──────────────────────────────────────────
const warehouses = [
  { id: "kurunegala",   name: "Kurunegala",   location: "Kurunegala, North Western Province" },
  { id: "anuradhapura", name: "Anuradhapura", location: "Anuradhapura, North Central Province" },
];

// ── 2. Products ────────────────────────────────────────────
const products = [
  { id: "p001", sku: "275-17-MRF-TT",  name: "2.75-17 MRF Tube Type",   brand: "MRF",    type: "bike",          size: "2.75-17", unitPrice: 2800 },
  { id: "p002", sku: "300-17-CEAT-TT", name: "3.00-17 CEAT Tube Type",  brand: "CEAT",   type: "bike",          size: "3.00-17", unitPrice: 3200 },
  { id: "p003", sku: "250-17-APL-TL",  name: "2.50-17 Apollo Tubeless", brand: "Apollo", type: "bike",          size: "2.50-17", unitPrice: 3600 },
  { id: "p004", sku: "400-8-CEAT-STD", name: "400-8 CEAT Standard",     brand: "CEAT",   type: "three_wheeler", size: "400-8",   unitPrice: 3400 },
  { id: "p005", sku: "400-8-MRF-STD",  name: "400-8 MRF Standard",      brand: "MRF",    type: "three_wheeler", size: "400-8",   unitPrice: 3600 },
  { id: "p006", sku: "400-8-APL-STD",  name: "400-8 Apollo Standard",   brand: "Apollo", type: "three_wheeler", size: "400-8",   unitPrice: 3300 },
];

// ── 3. Initial stock ───────────────────────────────────────
const stock = [
  { warehouseId: "kurunegala",   productId: "p001", qty: 48, reorderLevel: 10 },
  { warehouseId: "kurunegala",   productId: "p002", qty: 31, reorderLevel: 10 },
  { warehouseId: "kurunegala",   productId: "p003", qty:  8, reorderLevel: 10 },
  { warehouseId: "kurunegala",   productId: "p004", qty: 62, reorderLevel: 15 },
  { warehouseId: "kurunegala",   productId: "p005", qty: 44, reorderLevel: 15 },
  { warehouseId: "kurunegala",   productId: "p006", qty: 25, reorderLevel: 15 },
  { warehouseId: "anuradhapura", productId: "p001", qty: 55, reorderLevel: 10 },
  { warehouseId: "anuradhapura", productId: "p002", qty:  6, reorderLevel: 10 },
  { warehouseId: "anuradhapura", productId: "p004", qty: 38, reorderLevel: 15 },
  { warehouseId: "anuradhapura", productId: "p005", qty: 20, reorderLevel: 15 },
];

async function seed() {
  const now = Timestamp.now();

  // Warehouses
  for (const wh of warehouses) {
    await db.collection("warehouses").doc(wh.id).set({ ...wh, createdAt: now });
  }
  console.log("✅ Warehouses seeded");

  // Products
  for (const p of products) {
    await db.collection("products").doc(p.id).set({ ...p, active: true, createdAt: now });
  }
  console.log("✅ Products seeded");

  // Stock
  const productMap   = Object.fromEntries(products.map((p) => [p.id, p]));
  const warehouseMap = Object.fromEntries(warehouses.map((w) => [w.id, w]));

  for (const s of stock) {
    const docId = `${s.warehouseId}_${s.productId}`;
    const prod  = productMap[s.productId];
    const wh    = warehouseMap[s.warehouseId];
    await db.collection("stock").doc(docId).set({
      id:            docId,
      warehouseId:   s.warehouseId,
      warehouseName: wh.name,
      productId:     s.productId,
      productName:   prod.name,
      productSku:    prod.sku,
      productType:   prod.type,
      qty:           s.qty,
      reorderLevel:  s.reorderLevel,
      updatedAt:     now,
    });
  }
  console.log("✅ Stock seeded");

  // Admin user
  try {
    const userRecord = await auth.createUser({
      email:       "admin@tyrepro.lk",
      password:    "Admin@12345",
      displayName: "Admin",
    });
    await db.collection("users").doc(userRecord.uid).set({
      uid:         userRecord.uid,
      email:       "admin@tyrepro.lk",
      displayName: "Admin",
      role:        "admin",
      active:      true,
      createdAt:   now,
    });
    console.log("✅ Admin user created");
    console.log("   Email:    admin@tyrepro.lk");
    console.log("   Password: Admin@12345");
    console.log("   ⚠️  Change this password after first login!");
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      console.log("ℹ️  Admin user already exists — skipped");
    } else {
      throw err;
    }
  }

  console.log("\n🎉 Seed complete! You can now log in.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
