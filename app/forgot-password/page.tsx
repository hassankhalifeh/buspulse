"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { BusFront, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Only surface rate-limit / transport failures; never reveal whether the email exists.
    if (resetError && resetError.status === 429) {
      setError("تم إرسال عدد كبير من الطلبات. حاول مرة أخرى بعد قليل.");
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} className="card fade-in" style={{ padding: "2.25rem", width: 380, maxWidth: "90%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BusFront size={22} color="var(--orange)" />
          </div>
          <h1 style={{ fontSize: "1.35rem", color: "var(--navy)", margin: 0, fontWeight: 800 }}>Buspulse</h1>
        </div>
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", marginBottom: 22 }}>استعادة كلمة المرور</p>

        {sent ? (
          <p style={{ fontSize: "0.9rem", color: "#333", lineHeight: 1.7 }}>
            إن كان هذا البريد مسجّلاً لدينا فسيصلك رابط لإعادة تعيين كلمة المرور. تحقق من صندوق الوارد (وأيضاً الرسائل غير المرغوبة).
          </p>
        ) : (
          <>
            <label style={{ fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Mail size={14} /> البريد الإلكتروني
            </label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" style={{ margin: "6px 0 16px" }} />

            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
              {submitting ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
            </button>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.85rem" }}>
          <Link href="/admin" style={{ color: "var(--steel)" }}>العودة إلى تسجيل الدخول</Link>
        </p>
      </form>
    </main>
  );
}
