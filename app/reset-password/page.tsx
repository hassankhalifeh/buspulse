"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BusFront, Lock } from "lucide-react";

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // supabase-js reads the recovery token from the URL and creates a temporary session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecked(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`كلمة المرور يجب ألا تقل عن ${MIN_LENGTH} أحرف.`);
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    setDone(true);
    setSubmitting(false);
    setTimeout(() => router.push("/admin"), 2500);
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
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", marginBottom: 22 }}>تعيين كلمة مرور جديدة</p>

        {done ? (
          <p style={{ fontSize: "0.9rem", color: "#333", lineHeight: 1.7 }}>
            تم تغيير كلمة المرور بنجاح. سيتم تحويلك إلى صفحة تسجيل الدخول...
          </p>
        ) : !checked ? (
          <p style={{ fontSize: "0.9rem", color: "var(--steel)" }}>جارٍ التحقق من الرابط...</p>
        ) : !ready ? (
          <p style={{ fontSize: "0.9rem", color: "var(--red)", lineHeight: 1.7 }}>
            الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً من صفحة{" "}
            <Link href="/forgot-password" style={{ textDecoration: "underline" }}>نسيت كلمة المرور</Link>.
          </p>
        ) : (
          <>
            <label style={{ fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} /> كلمة المرور الجديدة
            </label>
            <input type="password" required minLength={MIN_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className="input" style={{ margin: "6px 0 16px" }} />

            <label style={{ fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} /> تأكيد كلمة المرور
            </label>
            <input type="password" required minLength={MIN_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" style={{ margin: "6px 0 16px" }} />

            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
              {submitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
