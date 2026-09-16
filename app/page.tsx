"use client";

import Link from "next/link";
import { BusFront, Phone, UserPlus } from "lucide-react";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card fade-in" style={{ padding: "2.25rem", width: 380, maxWidth: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BusFront size={22} color="var(--orange)" />
          </div>
          <h1 style={{ fontSize: "1.35rem", color: "var(--navy)", margin: 0, fontWeight: 800 }}>Buspulse</h1>
        </div>

        <Link href="/phone-login" className="btn btn-primary" style={{ width: "100%", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px" }}>
          <Phone size={18} /> تسجيل الدخول
        </Link>

        <Link href="/register" className="btn btn-secondary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px" }}>
          <UserPlus size={18} /> طلب تسجيل ولي أمر جديد
        </Link>
      </div>
    </main>
  );
}
