"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function QrLoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t");
  const entityType = params.get("type"); // "driver" | "guardian"

  const [status, setStatus] = useState<"loading" | "needs_setup" | "needs_pin" | "invalid">("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !entityType) { setStatus("invalid"); return; }
    const table = entityType === "driver" ? "drivers" : "guardians";
    supabase.from(table).select("pin_hash").eq("qr_token", token).maybeSingle()
      .then(({ data }) => {
        if (!data) { setStatus("invalid"); return; }
        setStatus(data.pin_hash ? "needs_pin" : "needs_setup");
      });
  }, [token, entityType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (status === "needs_setup" && pin !== confirmPin) { setError("الرقمان غير متطابقين."); return; }
    if (pin.length < 4) { setError("الرقم السري يجب أن يكون 4 أرقام على الأقل."); return; }

    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("qr-login-verify", {
      body: { token, entity_type: entityType, pin, is_setup: status === "needs_setup" },
    });
    setSubmitting(false);

    if (fnError || data?.error) { setError(data?.error ?? "حدث خطأ."); return; }

    const { error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash, type: "magiclink",
    });
    if (sessionError) { setError("تعذر تسجيل الدخول."); return; }

    router.push(entityType === "driver" ? "/driver" : "/guardian");
  }

  if (status === "loading") return <p style={{ padding: 24 }}>جارٍ التحقق...</p>;
  if (status === "invalid") return <p style={{ padding: 24, color: "var(--red)" }}>رمز غير صالح أو تم إبطاله — تواصل مع إدارة الأسطول.</p>;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} className="card" style={{ padding: "2rem", width: 340, maxWidth: "90%" }}>
        <h2 style={{ marginBottom: 16 }}>{status === "needs_setup" ? "اختر رقمك السري" : "أدخل رقمك السري"}</h2>
        <input type="password" inputMode="numeric" placeholder="الرقم السري" value={pin}
          onChange={(e) => setPin(e.target.value)} className="input" style={{ marginBottom: 12 }} />
        {status === "needs_setup" && (
          <input type="password" inputMode="numeric" placeholder="أعد كتابة الرقم" value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)} className="input" style={{ marginBottom: 12 }} />
        )}
        {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
          {submitting ? "..." : status === "needs_setup" ? "تأكيد" : "دخول"}
        </button>
      </form>
    </main>
  );
}

export default function QrLoginPage() {
  return (
    <Suspense
