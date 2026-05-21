import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
// @ts-ignore: CSS modules declaration not found for side-effect import
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dilshan Enterprises — Tire Distributors",
  description: "Tire distribution management — Anuradhapura District",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#534AB7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
