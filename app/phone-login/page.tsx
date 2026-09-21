"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Phone, Lock } from "lucide-react";

interface AccountOption { account_id: string; role: string; full_name: string; needs_setup: boolean; locked: boolean; }

const ROLE_LABEL: Record<string, string> = { owner: "صاحب الأسطول", admin: "إدارة", driver: "سائق", guardian: "ولي أمر", client_viewer: "مشاهد" };
const ROLE_HOME: Record<string, string> = { owner: "/admin", admin: "/admin", driver: "/driver", guardian: "/guardian", client_viewer: "/client" };

export default function PhoneLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "chooseRole" | "pin">("phone");
  const [phone, setPhone] = useState("");
  const [fleetSlug, setFleetSlug] = useState("");

  const [fleetName, setFleetName] = useState("");

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("f") ?? "";
    setFleetSlug(slug);
    if (!slug) return;
    supabase.functions.invoke("phone-login-lookup", { body: { action: "fleet_name", fleet_slug: slug } })
      .then(({ data }) => { if (data?.found) setFleetName(data.fleet_name); });
  }, []);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selected, setSelected] = useState<AccountOption | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function lookupPhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) { setError("أدخل رقم الهاتف."); return; }
    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("phone-login-lookup", { body: { phone: phone.trim(), fleet_slug: fleetSlug } });
    setSubmitting(false);
    if (fnError || !data?.found) { setError("تعذّر تسجيل الدخول. تأكد من الرقم والرابط الذي وصلك من إدارة الأسطول، أو تواصل معها."); return; }

    if (data.accounts.length === 1) {
      setSelected(data.accounts[0]);
      setStep("pin");
    } else {
      setAccounts(data.accounts);
      setStep("chooseRole");
    }
  }

  function chooseAccount(acc: AccountOption) {
    setSelected(acc);
    setStep("pin");
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selected) return;
    if (selected.needs_setup && pin !== confirmPin) { setError("الرقمان غير متطابقين."); return; }
    if (pin.length < 4) { setError("الرقم السري 4 أرقام على الأقل."); return; }

    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("phone-login-verify", {
      body: { account_id: selected.account_id, pin, is_setup: selected.needs_setup },
    });
    setSubmitting(false);

    if (fnError || data?.error) { setError(data?.error ?? "حدث خطأ."); return; }

    const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
    if (sessionError) { setError("تعذر تسجيل الدخول."); return; }

    router.push(ROLE_HOME[selected.role] ?? "/");
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card fade-in" style={{ padding: "2rem", width: 360, maxWidth: "100%" }}>
        <h2 style={{ marginBottom: fleetName ? 4 : 18, color: "var(--navy)" }}>تسجيل الدخول</h2>
        {fleetName && <p style={{ margin: "0 0 18px", color: "var(--steel)", fontSize: "0.95rem", fontWeight: 600 }}>{fleetName}</p>}

        {step === "phone" && (
          <form onSubmit={lookupPhone}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
              <Phone size={14} /> رقم الهاتف
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" style={{ marginBottom: 14 }} placeholder="مثال: 71234567" />
            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
              {submitting ? "..." : "متابعة"}
            </button>
          </form>
        )}

        {step === "chooseRole" && (
          <div>
            <p style={{ fontSize: "0.9rem", marginBottom: 14 }}>وُجد أكثر من حساب بهذا الرقم — أي صفة تريد استخدامها؟</p>
            {accounts.map((acc) => (
              <button
                key={acc.account_id}
                onClick={() => chooseAccount(acc)}
                disabled={acc.locked}
                className="card card-interactive"
                style={{ width: "100%", textAlign: "right", padding: "12px 16px", marginBottom: 8, border: "1.5px solid var(--fog-dark)", opacity: acc.locked ? 0.5 : 1 }}
              >
                {acc.full_name} — {ROLE_LABEL[acc.role] ?? acc.role} {acc.locked && "(مقفل مؤقتاً)"}
              </button>
            ))}
          </div>
        )}

        {step === "pin" && selected && (
          <form onSubmit={submitPin}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
              <Lock size={14} /> {selected.needs_setup ? "اختر رقمك السري" : "أدخل رقمك السري"} ({ROLE_LABEL[selected.role]})
            </label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="input" style={{ marginBottom: 10 }} />
            {selected.needs_setup && (
              <input type="password" inputMode="numeric" placeholder="أعد كتابة الرقم" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className="input" style={{ marginBottom: 10 }} />
            )}
            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
              {submitting ? "..." : "دخول"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
