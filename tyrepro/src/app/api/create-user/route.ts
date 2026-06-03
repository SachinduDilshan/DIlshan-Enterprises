import { NextRequest, NextResponse } from "next/server";

// Dynamically import firebase-admin to avoid edge runtime issues
async function getAdminAuth() {
  const { getAuth } = await import("firebase-admin/auth");
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  }

  return { auth: getAuth(), db: getFirestore() };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role, password } = body;

    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: "Name, email, role and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const { auth, db } = await getAdminAuth();

    // Create Firebase Auth user with the provided password
    const userRecord = await auth.createUser({
      email,
      displayName: name,
      password,
    });

    // Write Firestore profile
    await db.collection("users").doc(userRecord.uid).set({
      uid:         userRecord.uid,
      email,
      displayName: name,
      role,
      active:      true,
      createdAt:   new Date(),
    });

    return NextResponse.json({ uid: userRecord.uid, success: true });

  } catch (err: any) {
    console.error("Create user error:", err);

    // Return friendly error messages
    const friendlyErrors: Record<string, string> = {
      "auth/email-already-exists": "An account with this email already exists.",
      "auth/invalid-email":        "Invalid email address.",
      "auth/weak-password":        "Password is too weak. Use at least 6 characters.",
    };

    return NextResponse.json(
      { error: friendlyErrors[err.code] ?? err.message ?? "Failed to create account." },
      { status: 500 }
    );
  }
}