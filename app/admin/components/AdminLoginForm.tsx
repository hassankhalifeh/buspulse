"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { BusFront, Mail, Lock } from "lucide-react";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      setError(authError?.message ?? "تعذر تسجيل الدخول");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    // useAppUser() بالصفحة الأم بيلتقط الجلسة الجديدة تلقائياً ويعيد الرسم
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleLogin} className="card fade-in" style={{ padding: "2.25rem", width: 380, maxWidth: "90%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BusFront size={22} color="var(--orange)" />
          </div>
          <h1 style={{ fontSize: "1.35rem", color: "var(--navy)", margin: 0, fontWeight: 800 }}>Buspulse</h1>
        </div>
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", marginBottom: 22 }}>تسجيل دخول الإدارة</p>

        <label style={{ fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Mail size={14} /> البريد الإلكتروني
        </label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" style={{ margin: "6px 0 16px" }} />

        <label style={{ fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={14} /> كلمة المرور
        </label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" style={{ margin: "6px 0 16px" }} />

        {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
          {submitting ? "جارٍ الدخول..." : "دخول"}
        </button>

        <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.85rem" }}>
          <Link href="/forgot-password" style={{ color: "var(--steel)" }}>نسيت كلمة المرور؟</Link>
        </p>
      </form>
    </main>
  );
}
