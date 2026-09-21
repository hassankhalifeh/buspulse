"use client";

import LogoutButton from "@/app/components/LogoutButton";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface FleetRow {
  tenant_id: string;
  display_name: string;
  company_name: string | null;
  onboarding_completed: boolean;
  subscription_status: "trial" | "active" | "inactive";
  whatsapp_module_enabled: boolean;
  whatsapp_module_expires_at: string | null;
  whatsapp_connection_status: string;
  whatsapp_connection_error: string | null;
  pending_violations: number;
  logins: { role: string; login: string; real_email: boolean; must_change_password: boolean }[];
}

interface CreatedOwner { login: string; temp_password: string; real_email: boolean; warning: string | null }

interface ViolationRow {
  id: number;
  fleet: string | null;
  phone_number: string | null;
  contact: { full_name: string | null; role: string } | null;
  direction: "inbound" | "outbound" | "stored";
  context: string;
  content: string;
  matched_terms: string[];
  action_taken: string;
  created_at: string;
  review_status: "pending" | "confirmed" | "dismissed";
  review_note: string | null;
}

const DIRECTION_LABEL: Record<ViolationRow["direction"], string> = { inbound: "واردة", outbound: "صادرة من البوت", stored: "بيانات مُدخلة" };
const REVIEW_LABEL: Record<ViolationRow["review_status"], string> = { pending: "بانتظار المراجعة", confirmed: "مؤكَّدة", dismissed: "متجاهَلة" };

const STATUS_LABEL: Record<string, string> = { trial: "تجريبي", active: "نشط", inactive: "موقوف" };
const WA_LABEL: Record<string, string> = { not_configured: "غير مُعدّ", connected: "متصل", error: "خطأ", legacy_env: "إعداد الخادم" };

// Platform administration (visible only to platform admins): create fleet owners and manage each fleet's add-ons.
export default function PlatformPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [fleets, setFleets] = useState<FleetRow[]>([]);
  const [login, setLogin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedOwner | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [waExpiry, setWaExpiry] = useState<Record<string, string>>({});

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("platform-admin", { body });
    if (error) return { error: "تعذّر الاتصال بالخادم." } as any;
    return data as any;
  }, []);

  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [violationFilter, setViolationFilter] = useState<"pending" | "all">("pending");

  const loadViolations = useCallback(async () => {
    const data = await call({ action: "list_violations", status: violationFilter });
    if (data?.error) return setMessage({ ok: false, text: data.error });
    setViolations(data.violations ?? []);
  }, [call, violationFilter]);

  const load = useCallback(async () => {
    const data = await call({ action: "list_fleets" });
    if (data?.error) return setMessage({ ok: false, text: data.error });
    setFleets(data.fleets ?? []);
    loadViolations();
  }, [call, loadViolations]);

  async function reviewViolation(id: number, status: "confirmed" | "dismissed") {
    const note = window.prompt("ملاحظة المراجعة (اختياري):") ?? undefined;
    if (note === undefined) return;
    const data = await call({ action: "review_violation", id, status, note });
    if (data?.error) return setMessage({ ok: false, text: data.error });
    load();
  }

  useEffect(() => {
    supabase.rpc("is_platform_admin").then(({ data }) => {
      const ok = data === true;
      setAllowed(ok);
      if (ok) load();
    });
  }, [load]);

  async function createOwner(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setCreated(null);
    setCreating(true);
    const data = await call({ action: "create_owner", login, display_name: displayName });
    setCreating(false);
    if (data?.error) return setMessage({ ok: false, text: data.error });
    setCreated(data as CreatedOwner);
    setLogin("");
    setDisplayName("");
    load();
  }

  async function act(body: Record<string, unknown>, okText: string) {
    setMessage(null);
    const data = await call(body);
    if (data?.error) return setMessage({ ok: false, text: data.error });
    setMessage({ ok: true, text: okText });
    load();
  }

  if (allowed === null) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  if (!allowed) {
    return <main style={{ padding: 24 }}><p style={{ color: "var(--steel)" }}>هذه الصفحة لمدير المنصة فقط.</p><Link href="/admin">العودة</Link></main>;
  }

  const th: React.CSSProperties = { textAlign: "start", padding: "8px 6px", fontSize: "0.8rem", color: "var(--steel)", borderBottom: "1px solid var(--fog-dark, #ddd)" };
  const td: React.CSSProperties = { padding: "10px 6px", fontSize: "0.86rem", borderBottom: "1px solid var(--fog, #eee)", verticalAlign: "top" };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "1.75rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><LogoutButton redirectTo="/admin" /></div>
      <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
        <ArrowRight size={15} /> العودة إلى لوحة الإدارة
      </Link>

      <div className="card" style={{ padding: "1.5rem", marginBottom: 18 }}>
        <h1 style={{ fontSize: "1.2rem", color: "var(--navy)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><KeyRound size={19} /> إنشاء حساب لصاحب أسطول جديد</h1>
        <p style={{ fontSize: "0.86rem", color: "var(--steel)", margin: "0 0 12px" }}>
          تحدّد اسم المستخدم فقط. يصله حسابه بكلمة مرور مؤقتة، وعند أول دخول يغيّرها ثم يُدخل كل معلومات أسطوله بنفسه.
        </p>
        <form onSubmit={createOwner} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 230px" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>اسم المستخدم أو البريد الإلكتروني *</label>
            <input className="input" dir="ltr" style={{ width: "100%", marginTop: 4 }} value={login} onChange={(e) => setLogin(e.target.value)} placeholder="safe.trip  أو  owner@company.com" required />
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>اسم مبدئي للأسطول (اختياري)</label>
            <input className="input" style={{ width: "100%", marginTop: 4 }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <button type="submit" disabled={creating} className="btn btn-primary">{creating ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
        </form>
        <p style={{ fontSize: "0.8rem", color: "var(--steel)", margin: "10px 0 0" }}>
          💡 يُفضَّل البريد الإلكتروني الحقيقي لأنه أكثر أماناً وتُستعاد به كلمة المرور. اسم المستخدم متاح عند غياب البريد.
        </p>

        {created && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#EAF7EE" }}>
            <strong>تم إنشاء الحساب. سلّم هذه البيانات لصاحب الأسطول (لن تظهر مرة أخرى):</strong>
            <p style={{ margin: "8px 0 2px", fontSize: "0.86rem" }}>اسم المستخدم:</p>
            <div dir="ltr" style={{ fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: 8, textAlign: "left" }}>{created.login}</div>
            <p style={{ margin: "8px 0 2px", fontSize: "0.86rem" }}>كلمة المرور المؤقتة:</p>
            <div dir="ltr" style={{ fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: 8, textAlign: "left" }}>{created.temp_password}</div>
            <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigator.clipboard?.writeText(`اسم المستخدم: ${created.login}\nكلمة المرور المؤقتة: ${created.temp_password}`)}>نسخ البيانات</button>
            {created.warning && <p style={{ marginTop: 10, color: "#8A5A00", fontSize: "0.84rem" }}>⚠️ {created.warning}</p>}
          </div>
        )}
      </div>

      {message && <p style={{ color: message.ok ? "green" : "var(--red)", fontSize: "0.9rem", marginBottom: 12 }}>{message.text}</p>}

      <div className="card" style={{ padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", color: "var(--navy)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}><Building2 size={18} /> الأساطيل ({fleets.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>الأسطول</th><th style={th}>الدخول</th><th style={th}>الحالة</th><th style={th}>خدمة الواتساب</th><th style={th}>مخالفات معلّقة</th><th style={th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {fleets.map((f) => (
                <tr key={f.tenant_id}>
                  <td style={td}>
                    <strong>{f.company_name || f.display_name}</strong>
                    <div style={{ fontSize: "0.76rem", color: f.onboarding_completed ? "green" : "#8A5A00" }}>{f.onboarding_completed ? "إعداد المعلومات مكتمل" : "بانتظار إكمال المعلومات"}</div>
                  </td>
                  <td style={td}>
                    {f.logins.map((l, i) => (
                      <div key={i} dir="ltr" style={{ textAlign: "start", fontSize: "0.8rem" }}>
                        {l.login} {!l.real_email && <span title="بلا بريد إلكتروني حقيقي">⚠️</span>} {l.must_change_password && <span title="لم يغيّر كلمة المرور المؤقتة">🔑</span>}
                      </div>
                    ))}
                  </td>
                  <td style={td}>{STATUS_LABEL[f.subscription_status] ?? f.subscription_status}</td>
                  <td style={td}>
                    {f.whatsapp_module_enabled ? (
                      <>
                        <span style={{ color: "green" }}>مفعّلة</span>
                        {f.whatsapp_module_expires_at && <div style={{ fontSize: "0.76rem", color: "var(--steel)" }}>حتى {new Date(f.whatsapp_module_expires_at).toLocaleDateString("ar")}</div>}
                        <div style={{ fontSize: "0.76rem", color: f.whatsapp_connection_status === "error" ? "var(--red)" : "var(--steel)" }}>الاتصال: {WA_LABEL[f.whatsapp_connection_status] ?? f.whatsapp_connection_status}</div>
                      </>
                    ) : <span style={{ color: "var(--steel)" }}>غير مفعّلة</span>}
                  </td>
                  <td style={{ ...td, color: f.pending_violations > 0 ? "var(--red)" : "var(--steel)", fontWeight: f.pending_violations > 0 ? 700 : 400 }}>{f.pending_violations}</td>
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                      {f.whatsapp_module_enabled ? (
                        <button className="btn btn-secondary" onClick={() => act({ action: "set_whatsapp_module", tenant_id: f.tenant_id, enabled: false }, "أُوقفت خدمة الواتساب لهذا الأسطول.")}>إيقاف الواتساب</button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <input type="date" className="input" style={{ width: 150 }} value={waExpiry[f.tenant_id] ?? ""} onChange={(e) => setWaExpiry({ ...waExpiry, [f.tenant_id]: e.target.value })} title="تاريخ انتهاء الاشتراك (اتركه فارغاً لبلا انتهاء)" />
                          <button className="btn btn-primary" onClick={() => act({ action: "set_whatsapp_module", tenant_id: f.tenant_id, enabled: true, expires_at: waExpiry[f.tenant_id] || null }, "فُعّلت خدمة الواتساب لهذا الأسطول.")}>تفعيل الواتساب</button>
                        </div>
                      )}
                      {f.subscription_status === "inactive" ? (
                        <button className="btn btn-secondary" onClick={() => act({ action: "set_status", tenant_id: f.tenant_id, status: "active" }, "أُعيد تفعيل الأسطول.")}>إعادة تفعيل الأسطول</button>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => { if (window.confirm("إيقاف الأسطول سيمنع الدخول عن كل مستخدميه (إدارة وسائقين وأولياء أمور). متابعة؟")) act({ action: "set_status", tenant_id: f.tenant_id, status: "inactive" }, "أُوقف الأسطول."); }}>إيقاف الأسطول</button>
                      )}
                      {f.subscription_status === "trial" && (
                        <button className="btn btn-secondary" onClick={() => act({ action: "set_status", tenant_id: f.tenant_id, status: "active" }, "اعتُمد الاشتراك كنشط.")}>اعتماد كنشط</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {fleets.length === 0 && <tr><td style={td} colSpan={6}>لا توجد أساطيل.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginTop: 18 }}>
        <h2 style={{ fontSize: "1.1rem", color: "var(--navy)", margin: "0 0 4px" }}>مخالفات المحتوى (كل الأساطيل)</h2>
        <p style={{ fontSize: "0.84rem", color: "var(--steel)", margin: "0 0 10px" }}>
          كل رسالة أو إدخال يحتوي ألفاظاً غير لائقة يُمنع تلقائياً ويُسجَّل بنصه الأصلي بشكل دائم لا يُعدَّل ولا يُحذف. قرارك (تأكيد أو تجاهل) يُحفظ مع ملاحظتك ووقته.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button className={`btn ${violationFilter === "pending" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViolationFilter("pending")}>بانتظار المراجعة</button>
          <button className={`btn ${violationFilter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViolationFilter("all")}>الكل</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>الوقت</th><th style={th}>الأسطول</th><th style={th}>الشخص</th><th style={th}>النوع</th><th style={th}>المحتوى</th><th style={th}>المراجعة</th></tr></thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id}>
                  <td style={td}>{new Date(v.created_at).toLocaleString("ar")}</td>
                  <td style={td}>{v.fleet ?? "—"}</td>
                  <td style={td}>{v.contact?.full_name ?? "—"}<div dir="ltr" style={{ textAlign: "start", fontSize: "0.76rem", color: "var(--steel)" }}>{v.phone_number ?? ""}</div></td>
                  <td style={td}>{DIRECTION_LABEL[v.direction]}<div style={{ fontSize: "0.74rem", color: "var(--steel)" }}>{v.context}</div></td>
                  <td style={{ ...td, maxWidth: 260, wordBreak: "break-word" }}>{v.content}<div style={{ fontSize: "0.74rem", color: "var(--red)" }}>{v.matched_terms.join("، ")}</div></td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{REVIEW_LABEL[v.review_status]}</div>
                    {v.review_note && <div style={{ fontSize: "0.78rem" }}>{v.review_note}</div>}
                    {v.review_status === "pending" && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button className="btn btn-primary" onClick={() => reviewViolation(v.id, "confirmed")}>تأكيد</button>
                        <button className="btn btn-secondary" onClick={() => reviewViolation(v.id, "dismissed")}>تجاهل</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {violations.length === 0 && <tr><td style={td} colSpan={6}>لا توجد مخالفات {violationFilter === "pending" ? "بانتظار المراجعة" : "مسجّلة"}. 👍</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
