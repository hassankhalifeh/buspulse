"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus } from "lucide-react";

interface ChildRow { child_name: string; relation: string; }

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlToken = params.get("t");

  const [accessToken, setAccessToken] = useState<string | null>(urlToken);
  const [loading, setLoading] = useState(!!urlToken);
    const [status, setStatus] = useState<"new" | "pending" | "rejected" | "approved" | null>(urlToken ? null : "new");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [needsPinSetup, setNeedsPinSetup] = useState(true);
  const [loginPin, setLoginPin] = useState("");
  const [confirmLoginPin, setConfirmLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [children, setChildren] = useState<ChildRow[]>([{ child_name: "", relation: "Father" }]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const FLEET_ID = "9812348a-e836-4438-9bf4-26a801a467f1";

  useEffect(() => {
    if (!urlToken) return;
    supabase.functions.invoke("registration-status", { body: { access_token: urlToken } }).then(({ data }) => {
      setLoading(false);
      if (!data?.found) { setStatus("new"); setAccessToken(null); return; }
      if (data.status === "approved") {
        setStatus("approved");
        supabase.functions.invoke("phone-login-lookup", { body: { phone: data.phone } }).then(({ data: lookupData }) => {
          if (lookupData?.accounts?.length) {
            setAccountId(lookupData.accounts[0].account_id);
            setNeedsPinSetup(lookupData.accounts[0].needs_setup);
          }
        });
        return;
      }      if (data.status === "rejected") { setStatus("rejected"); return; }
      setStatus("pending");
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setSchoolName(data.school_name ?? "");
      setAddress(data.address ?? "");
      if (data.children?.length) setChildren(data.children);
    });
  }, [urlToken]);

  function addChild() { setChildren([...children, { child_name: "", relation: "Father" }]); }
  function removeChild(i: number) { setChildren(children.filter((_, idx) => idx !== i)); }
  function updateChild(i: number, key: keyof ChildRow, value: string) {
    setChildren(children.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName || !phone) { setError("الاسم والهاتف إلزاميان."); return; }
    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("registration-submit", {
      body: {
        access_token: accessToken,
        fleet_id: FLEET_ID,
        full_name: fullName, phone, school_name: schoolName, address,
        children: children.filter((c) => c.child_name.trim()),
      },
    });
    setSubmitting(false);
    if (fnError || data?.error) { setError(data?.error ?? "حدث خطأ."); return; }
    const newToken = data.access_token;
    router.push(`/register?t=${newToken}`);
    setAccessToken(newToken);
    setStatus("pending");
  }
    async function submitApprovedPin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!accountId) { setLoginError("تعذّر إيجاد الحساب."); return; }
    if (needsPinSetup && loginPin !== confirmLoginPin) { setLoginError("الرقمان غير متطابقين."); return; }
    if (loginPin.length < 4) { setLoginError("الرقم السري 4 أرقام على الأقل."); return; }

    setLoginSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("phone-login-verify", {
      body: { account_id: accountId, pin: loginPin, is_setup: needsPinSetup },
    });
    setLoginSubmitting(false);
    if (fnError || data?.error) { setLoginError(data?.error ?? "حدث خطأ."); return; }

    const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
    if (sessionError) { setLoginError("تعذر تسجيل الدخول."); return; }
    router.push("/guardian");
  }

  if (loading) return <p style={{ padding: 24 }}>جارٍ التحقق...</p>;

   if (status === "approved") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <form onSubmit={submitApprovedPin} className="card" style={{ padding: "2rem", textAlign: "center", maxWidth: 380, width: "100%" }}>
          <h2 style={{ color: "var(--green)", marginBottom: 10 }}>تمت الموافقة على طلبك ✓</h2>
          <p style={{ marginBottom: 16, fontSize: "0.9rem" }}>{needsPinSetup ? "اختر رقمك السري لإكمال الدخول" : "أدخل رقمك السري للدخول"}</p>
          <input type="password" inputMode="numeric" placeholder="الرقم السري" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} className="input" style={{ marginBottom: 10 }} />
          {needsPinSetup && (
            <input type="password" inputMode="numeric" placeholder="أعد كتابة الرقم" value={confirmLoginPin} onChange={(e) => setConfirmLoginPin(e.target.value)} className="input" style={{ marginBottom: 10 }} />
          )}
          {loginError && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 10 }}>{loginError}</p>}
          <button type="submit" disabled={loginSubmitting} className="btn btn-primary" style={{ width: "100%" }}>
            {loginSubmitting ? "..." : "دخول"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <form onSubmit={submit} className="card fade-in" style={{ maxWidth: 480, margin: "0 auto", padding: "1.75rem" }}>
        <h2 style={{ marginBottom: 6, color: "var(--navy)" }}>تسجيل ولي أمر جديد</h2>
        {status === "pending" && (
          <p style={{ color: "var(--orange)", fontSize: "0.85rem", marginBottom: 16 }}>
            طلبك قيد المراجعة حالياً — يمكنك تعديل بياناتك أدناه ريثما تتم الموافقة.
          </p>
        )}

        <input placeholder="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" style={{ marginBottom: 10 }} />
        <input placeholder="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" style={{ marginBottom: 10 }} />
        <input placeholder="اسم المدرسة" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="input" style={{ marginBottom: 10 }} />
        <input placeholder="عنوان السكن" value={address} onChange={(e) => setAddress(e.target.value)} className="input" style={{ marginBottom: 16 }} />

        <p style={{ fontWeight: 700, marginBottom: 8 }}>الأبناء</p>
        {children.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input placeholder="اسم الطالب" value={c.child_name} onChange={(e) => updateChild(i, "child_name", e.target.value)} className="input" style={{ flex: 2 }} />
            <select value={c.relation} onChange={(e) => updateChild(i, "relation", e.target.value)} className="input" style={{ flex: 1 }}>
              <option value="Father">أب</option>
              <option value="Mother">أم</option>
              <option value="Grandfather">جد</option>
              <option value="Uncle">عم/خال</option>
              <option value="Other">أخرى</option>
            </select>
            {children.length > 1 && (
              <button type="button" onClick={() => removeChild(i)} style={{ background: "none", border: "none", color: "var(--red)" }}><X size={18} /></button>
            )}
          </div>
        ))}
        <button type="button" onClick={addChild} className="btn btn-secondary" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
          <Plus size={14} /> إضافة ابن آخر
        </button>

        {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
          {submitting ? "..." : status === "pending" ? "تحديث الطلب" : "إرسال الطلب"}
        </button>
      </form>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>جارٍ التحميل...</p>}>
      <RegisterInner />
    </Suspense>
  );
}
