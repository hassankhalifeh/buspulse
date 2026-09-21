"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppUser } from "@/lib/useAppUser";

interface WaStatus {
  module_active: boolean;
  module_expires_at: string | null;
  connection_status: "not_configured" | "connected" | "error" | "legacy_env";
  connection_checked_at: string | null;
  connection_error: string | null;
  business_number: string | null;
  phone_number_id_masked: string | null;
  webhook_url: string;
  verify_token: string | null;
}

const STATUS_LABEL: Record<WaStatus["connection_status"], { text: string; color: string }> = {
  not_configured: { text: "غير مُعدّ", color: "var(--steel)" },
  connected: { text: "متصل ✓", color: "green" },
  error: { text: "خطأ في الاتصال", color: "var(--red)" },
  legacy_env: { text: "يعمل بإعداد الخادم ✓", color: "green" },
};

const label: React.CSSProperties = { fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "block", marginTop: 12 };
const field: React.CSSProperties = { marginTop: 6, width: "100%" };
const mono: React.CSSProperties = { direction: "ltr", textAlign: "left", fontFamily: "monospace", fontSize: "0.82rem", background: "var(--fog, #f3f5f7)", padding: "8px 10px", borderRadius: 8, wordBreak: "break-all" };

// WhatsApp is an optional add-on. This page works only while the platform has switched it on for the fleet;
// everything here talks to the wa-tenant-setup function, so a problem here never touches the core app.
export default function WhatsappSetupPage() {
  const { appUser, loading } = useAppUser();
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ business_number: "", phone_number_id: "", access_token: "", app_secret: "" });

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("wa-tenant-setup", { body: { action, ...extra } });
    if (error) return { error: "تعذّر الاتصال بالخادم." } as any;
    return data as any;
  }, []);

  const refresh = useCallback(async () => {
    const data = await call("status");
    if (data?.error) setMessage({ ok: false, text: data.error });
    else setStatus(data as WaStatus);
  }, [call]);

  useEffect(() => {
    if (appUser && (appUser.role === "owner" || appUser.role === "admin")) refresh();
  }, [appUser, refresh]);

  async function run(action: string, extra: Record<string, unknown> = {}, okText?: string) {
    setBusy(true);
    setMessage(null);
    const data = await call(action, extra);
    setBusy(false);
    if (data?.error) return setMessage({ ok: false, text: data.error });
    if (data?.connection_status !== undefined) setStatus(data as WaStatus);
    if (okText) setMessage({ ok: true, text: okText });
    if (action === "save") setForm({ business_number: "", phone_number_id: "", access_token: "", app_secret: "" });
  }

  if (loading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin")) {
    return <main style={{ padding: 24 }}><p style={{ color: "var(--steel)" }}>هذه الصفحة لإدارة الأسطول فقط.</p><Link href="/admin">العودة</Link></main>;
  }

  const st = status ? STATUS_LABEL[status.connection_status] : null;
  const connected = status?.connection_status === "connected" || status?.connection_status === "legacy_env";

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.75rem 1rem" }}>
      <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
        <ArrowRight size={15} /> العودة إلى لوحة الإدارة
      </Link>

      <div className="card" style={{ padding: "1.75rem" }}>
        <h1 style={{ fontSize: "1.25rem", color: "var(--navy)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <MessageCircle size={20} /> خدمة الواتساب
        </h1>
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", margin: 0 }}>
          خدمة إضافية: إشعارات لأولياء الأمور، ومتابعة الرحلات، ومصاريف السائقين، وتنبيهات الطوارئ عبر واتساب. تعمل بشكل مستقل، وأي عطل فيها لا يوقف برنامجك الأساسي.
        </p>

        {!status && !message && <p style={{ marginTop: 16, color: "var(--steel)" }}>جارٍ التحميل...</p>}

        {status && !status.module_active && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: "#FFF6E5" }}>
            <strong>الخدمة غير مفعّلة لأسطولك.</strong>
            <p style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
              تواصل معنا لتفعيلها. بعد التفعيل تظهر لك هنا صفحة الإعداد، ويعمل النظام بمعلوماتك دون أي تدخل منا.
              {status.module_expires_at && ` (انتهى اشتراك الخدمة بتاريخ ${new Date(status.module_expires_at).toLocaleDateString("ar")})`}
            </p>
          </div>
        )}

        {status?.module_active && st && (
          <>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span>الحالة: <strong style={{ color: st.color }}>{st.text}</strong></span>
              {status.module_expires_at && <span style={{ fontSize: "0.82rem", color: "var(--steel)" }}>اشتراك الخدمة حتى {new Date(status.module_expires_at).toLocaleDateString("ar")}</span>}
            </div>
            {status.business_number && <p style={{ fontSize: "0.88rem", margin: "6px 0 0" }}>الرقم: <span dir="ltr">{status.business_number}</span> {status.phone_number_id_masked && <span dir="ltr" style={{ color: "var(--steel)" }}>({status.phone_number_id_masked})</span>}</p>}
            {status.connection_error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: 8 }}>آخر خطأ: {status.connection_error}</p>}

            {status.connection_status === "legacy_env" ? (
              <p style={{ marginTop: 14, fontSize: "0.88rem", color: "var(--steel)" }}>
                خدمة الواتساب لأسطولك مُعدّة مسبقاً من قبل الإدارة الفنية، ولا تحتاج منك إلى أي إجراء.
              </p>
            ) : (
              <>
                <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: "var(--fog, #f3f5f7)", fontSize: "0.86rem", lineHeight: 1.8 }}>
                  <strong>من أين أحصل على البيانات؟</strong> (من لوحة Meta for Developers ← تطبيقك ← WhatsApp ← API Setup)
                  <ol style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
                    <li><b>رقم واتساب الأعمال:</b> الرقم الذي سيرسل ويستقبل الرسائل.</li>
                    <li><b>Phone number ID:</b> يظهر تحت الرقم في صفحة API Setup.</li>
                    <li><b>Access token:</b> يُفضَّل رمز دائم (System User)، فالمؤقت ينتهي خلال ساعات.</li>
                    <li><b>App Secret (اختياري):</b> من App settings ← Basic. أدخله فقط إن كان التطبيق خاصاً بك.</li>
                  </ol>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); run("save", form, "تم التحقق مع Meta وحفظ الإعداد ✓"); }}
                  autoComplete="off"
                >
                  <label style={label}>رقم واتساب الأعمال *</label>
                  <input className="input" style={field} dir="ltr" required value={form.business_number} onChange={(e) => setForm({ ...form, business_number: e.target.value })} placeholder="+9617xxxxxxx" />
                  <label style={label}>Phone number ID *</label>
                  <input className="input" style={field} dir="ltr" required value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
                  <label style={label}>Access token *</label>
                  <input className="input" style={field} dir="ltr" type="password" required value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} autoComplete="new-password" />
                  <label style={label}>App Secret (اختياري)</label>
                  <input className="input" style={field} dir="ltr" type="password" value={form.app_secret} onChange={(e) => setForm({ ...form, app_secret: e.target.value })} autoComplete="new-password" />
                  <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: "100%", marginTop: 16 }}>
                    {busy ? "جارٍ التحقق مع Meta..." : status.connection_status === "not_configured" ? "تحقق واحفظ" : "تحديث البيانات"}
                  </button>
                </form>

                {status.verify_token && (
                  <div style={{ marginTop: 18 }}>
                    <strong style={{ fontSize: "0.9rem" }}>الخطوة الأخيرة: اربط الـ Webhook في Meta</strong>
                    <p style={{ fontSize: "0.84rem", color: "var(--steel)", margin: "4px 0 8px" }}>WhatsApp ← Configuration ← Webhook ← Edit، ثم اشترك في الحقل <b>messages</b>.</p>
                    <p style={{ fontSize: "0.82rem", margin: "6px 0 2px" }}>Callback URL</p>
                    <div style={mono}>{status.webhook_url}</div>
                    <p style={{ fontSize: "0.82rem", margin: "8px 0 2px" }}>Verify token</p>
                    <div style={mono}>{status.verify_token}</div>
                  </div>
                )}

                {status.connection_status !== "not_configured" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => run("test", {}, "تم فحص الاتصال ✓")}>اختبار الاتصال</button>
                    <button
                      className="btn btn-secondary" disabled={busy}
                      onClick={() => { if (window.confirm("فصل خدمة الواتساب؟ لن يتفاعل البوت مع الرسائل حتى تعيد الإعداد. بياناتك محفوظة.")) run("disconnect", {}, "تم فصل الخدمة."); }}
                    >فصل الخدمة</button>
                  </div>
                )}
              </>
            )}

            {connected && status.connection_status !== "legacy_env" && (
              <p style={{ fontSize: "0.82rem", color: "var(--steel)", marginTop: 14 }}>
                بعد الربط، أضف جهات الاتصال (السائقون وأولياء الأمور) من قسم «بوت الواتساب» في لوحة الإدارة.
              </p>
            )}
          </>
        )}

        {message && <p style={{ color: message.ok ? "green" : "var(--red)", fontSize: "0.88rem", marginTop: 14 }}>{message.text}</p>}
      </div>
    </main>
  );
}
