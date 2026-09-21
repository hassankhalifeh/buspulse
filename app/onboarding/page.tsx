"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BusFront, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppUser } from "@/lib/useAppUser";
import { useFleetInfo } from "@/lib/useFleetInfo";
import FleetInfoForm from "../admin/components/FleetInfoForm";

const MIN_PASSWORD = 8;

// First screen a new fleet owner sees: (1) replace the temporary password, (2) enter everything that
// describes the fleet. Only then does the dashboard open.
export default function OnboardingPage() {
  const router = useRouter();
  const { appUser, loading } = useAppUser();
  const { fleet, loading: fleetLoading, reload } = useFleetInfo(appUser);

  const [passwordDone, setPasswordDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card fade-in" style={{ padding: "2rem", width: 460, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BusFront size={22} color="var(--orange)" />
          </div>
          <h1 style={{ fontSize: "1.35rem", color: "var(--navy)", margin: 0, fontWeight: 800 }}>Buspulse</h1>
        </div>
        {children}
      </div>
    </main>
  );

  if (loading || fleetLoading) return shell(<p style={{ color: "var(--steel)" }}>جارٍ التحميل...</p>);

  if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin") || !fleet) {
    return shell(
      <>
        <p style={{ color: "var(--steel)", marginBottom: 14 }}>سجّل الدخول بحساب إدارة الأسطول أولاً.</p>
        <Link href="/admin" className="btn btn-primary" style={{ display: "block", textAlign: "center" }}>تسجيل الدخول</Link>
      </>
    );
  }

  const needsPassword = appUser.must_change_password === true && !passwordDone;

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD} أحرف.`);
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      return setError(updateError.message);
    }
    await supabase.from("app_users").update({ must_change_password: false }).eq("id", appUser!.id);
    setSaving(false);
    setPasswordDone(true);
  }

  if (needsPassword) {
    return shell(
      <form onSubmit={handlePassword}>
        <p style={{ fontSize: "0.9rem", color: "var(--steel)", margin: "6px 0 16px" }}>
          الخطوة 1 من 2: اختر كلمة مرور جديدة بدل المؤقتة.
        </p>
        <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}><Lock size={14} /> كلمة المرور الجديدة</label>
        <input className="input" type="password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} style={{ margin: "6px 0 14px", width: "100%" }} />
        <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}><Lock size={14} /> تأكيد كلمة المرور</label>
        <input className="input" type="password" required minLength={MIN_PASSWORD} value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ margin: "6px 0 14px", width: "100%" }} />
        {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: "100%" }}>
          {saving ? "جارٍ الحفظ..." : "حفظ ومتابعة"}
        </button>
      </form>
    );
  }

  return shell(
    <>
      <p style={{ fontSize: "0.9rem", color: "var(--steel)", margin: "6px 0 4px" }}>
        {appUser.must_change_password === false && !passwordDone ? "" : "الخطوة 2 من 2: "}أدخل معلومات أسطولك. يمكنك تعديلها لاحقاً من «إعدادات الأسطول».
      </p>
      <FleetInfoForm
        fleet={fleet}
        submitLabel="حفظ وبدء العمل"
        markCompleted
        onSaved={async () => {
          await reload();
          router.push("/admin");
        }}
      />
    </>
  );
}
