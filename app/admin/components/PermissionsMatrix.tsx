"use client";

import { useEffect, useMemo, useState } from "react";
import { useTableKit } from "@/lib/tablekit";
import { supabase } from "@/lib/supabaseClient";
import { Check, AlertTriangle, UserPlus, KeyRound, Trash2, Copy } from "lucide-react";

interface AppUserRow { id: string; full_name: string; role: string; }
interface Capability { key: string; label_ar: string; category: string; }

const ROLE_AR: Record<string, string> = { owner: "صاحب الأسطول", admin: "مدير", assistant: "موظف", driver: "سائق", guardian: "ولي أمر", client_viewer: "مشاهد" };
const PERM_COLUMNS = [
  { key: "full_name", label: "المستخدم" }, { key: "role_label", label: "الدور" }, { key: "granted_text", label: "الصلاحيات الممنوحة" },
];

// The literal "warn before granting a conflicting permission" screen —
// every checkbox writes straight to user_capabilities, and toggling
// one ON first asks the database (get_conflict_warnings, from
// buspulse-upgrade/04b) whether this creates a known conflict for
// this specific person, showing the warning before confirming.
export default function PermissionsMatrix({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
  // Staff accounts (created here, limited by the ticks below)
  const [showAdd, setShowAdd] = useState(false);
  const [staffLogin, setStaffLogin] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{ who: string; login?: string; password: string; warning?: string | null } | null>(null);
  const [pendingWarning, setPendingWarning] = useState<{ userId: string; capKey: string; messages: string[] } | null>(null);

  async function load() {
    const [{ data: userRows }, { data: capRows }] = await Promise.all([
      supabase.from("app_users").select("id, full_name, role").eq("tenant_id", tenantId),
      supabase.from("capabilities").select("*"),
    ]);
    setUsers(userRows ?? []);
    setCapabilities(capRows ?? []);

    if (userRows && userRows.length > 0) {
      const { data: grantRows } = await supabase
        .from("user_capabilities")
        .select("app_user_id, capability_key, granted")
        .in("app_user_id", userRows.map((u) => u.id));

      const map: Record<string, Set<string>> = {};
      (grantRows ?? []).forEach((g) => {
        if (!g.granted) return;
        if (!map[g.app_user_id]) map[g.app_user_id] = new Set();
        map[g.app_user_id].add(g.capability_key);
      });
      setGrants(map);
    }
  }

  useEffect(() => { load(); }, [tenantId]);

  async function callStaff(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("fleet-staff", { body });
    if (error) return { error: "تعذّر الاتصال بالخادم." } as any;
    return data as any;
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setStaffMsg(null);
    setStaffBusy(true);
    const data = await callStaff({ action: "create_assistant", login: staffLogin, full_name: staffName });
    setStaffBusy(false);
    if (data?.error) return setStaffMsg({ ok: false, text: data.error });
    setCredentials({ who: staffName, login: data.login, password: data.temp_password, warning: data.warning });
    setStaffLogin(""); setStaffName(""); setShowAdd(false);
    load();
  }

  async function resetStaffPassword(u: AppUserRow) {
    if (!window.confirm(`إعادة تعيين كلمة مرور «${u.full_name}»؟ ستُنشأ كلمة مؤقتة جديدة وتُلغى القديمة.`)) return;
    const data = await callStaff({ action: "reset_password", app_user_id: u.id });
    if (data?.error) return setStaffMsg({ ok: false, text: data.error });
    setCredentials({ who: u.full_name, password: data.temp_password });
  }

  async function removeStaff(u: AppUserRow) {
    if (!window.confirm(`إزالة الموظف «${u.full_name}»؟ يُحذف حسابه وصلاحياته ولا يمكنه الدخول بعدها.`)) return;
    const data = await callStaff({ action: "remove_assistant", app_user_id: u.id });
    if (data?.error) return setStaffMsg({ ok: false, text: data.error });
    setStaffMsg({ ok: true, text: data.note ?? "أُزيل الموظف." });
    load();
  }

  async function applyGrant(userId: string, capKey: string) {
    await supabase.from("user_capabilities").upsert(
      { app_user_id: userId, capability_key: capKey, granted: true },
      { onConflict: "app_user_id,capability_key" }
    );
    setGrants((g) => {
      const next = { ...g, [userId]: new Set(g[userId] ?? []) };
      next[userId].add(capKey);
      return next;
    });
  }

  async function revoke(userId: string, capKey: string) {
    await supabase.from("user_capabilities").delete().eq("app_user_id", userId).eq("capability_key", capKey);
    setGrants((g) => {
      const next = { ...g, [userId]: new Set(g[userId] ?? []) };
      next[userId].delete(capKey);
      return next;
    });
  }

  async function toggle(userId: string, capKey: string, currentlyGranted: boolean) {
    if (currentlyGranted) {
      await revoke(userId, capKey);
      return;
    }
    const { data: warnings } = await supabase.rpc("get_conflict_warnings", { p_app_user_id: userId, p_new_capability: capKey });
    const messages = (warnings ?? []).map((w: any) => w.warning);
    if (messages.length > 0) {
      setPendingWarning({ userId, capKey, messages });
    } else {
      applyGrant(userId, capKey);
    }
  }

  // Search/filter plug-in (lib/tablekit): by name, role, or a granted permission's name.
  const view = useMemo(() => users.map((u) => ({
    ...u,
    role_label: ROLE_AR[u.role] ?? u.role,
    granted_text: ["owner", "admin"].includes(u.role)
      ? "كل الصلاحيات"
      : capabilities.filter((c) => grants[u.id]?.has(c.key)).map((c) => c.label_ar).join("، "),
  })), [users, capabilities, grants]);
  const tk = useTableKit(view, PERM_COLUMNS);

  if (users.length === 0) return <p style={{ color: "var(--steel)" }}>لا يوجد مستخدمون بعد.</p>;

  const categories = Array.from(new Set(capabilities.map((c) => c.category)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--steel)", maxWidth: 560 }}>
          الموظفون حسابات تنشئها هنا، وتحدّد بالخانات أدناه ما يستطيع كل موظف فتحه فقط. صاحب الأسطول والمدير يملكان كل شيء تلقائياً.
        </p>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setStaffMsg(null); }}><UserPlus size={16} /> إضافة موظف</button>
      </div>
      {staffMsg && <p style={{ color: staffMsg.ok ? "green" : "var(--red)", fontSize: "0.88rem", marginBottom: 10 }}>{staffMsg.text}</p>}
      {!users.some((u) => u.role === "assistant") && (
        <p style={{ color: "var(--steel)", fontSize: "0.86rem", marginBottom: 10 }}>لا يوجد موظفون بعد. اضغط «إضافة موظف» لإنشاء أول حساب، ثم تظهر خاناته هنا لتمنحه الصلاحيات.</p>
      )}
      {credentials && (
        <div style={{ marginBottom: 14, padding: 14, borderRadius: 10, background: "#EAF7EE" }}>
          <strong>سلّم هذه البيانات لـ «{credentials.who}» (لن تظهر مرة أخرى):</strong>
          {credentials.login && (
            <>
              <p style={{ margin: "8px 0 2px", fontSize: "0.86rem" }}>اسم المستخدم:</p>
              <div dir="ltr" style={{ fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: 8, textAlign: "left" }}>{credentials.login}</div>
            </>
          )}
          <p style={{ margin: "8px 0 2px", fontSize: "0.86rem" }}>كلمة المرور المؤقتة:</p>
          <div dir="ltr" style={{ fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: 8, textAlign: "left" }}>{credentials.password}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText((credentials.login ? "اسم المستخدم: " + credentials.login + "\n" : "") + "كلمة المرور المؤقتة: " + credentials.password)}><Copy size={14} /> نسخ</button>
            <button className="btn btn-secondary" onClick={() => setCredentials(null)}>تم</button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "#555" }}>يُطلب منه تغيير كلمة المرور عند أول دخول، ثم يفتح /admin ويرى الصفحات المسموحة له فقط.</p>
          {credentials.warning && <p style={{ marginTop: 8, color: "#8A5A00", fontSize: "0.82rem" }}>⚠️ {credentials.warning}</p>}
        </div>
      )}
      {tk.toolbar}
      {tk.rows.length === 0 && <p style={{ color: "var(--steel)" }}>لا توجد نتائج مطابقة.</p>}
      <div className="card fade-in" style={{ overflowX: "auto", padding: "0.5rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              {categories.map((cat) =>
                capabilities.filter((c) => c.category === cat).map((c) => (
                  <th key={c.key} style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>{c.label_ar}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {tk.rows.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>
                  {u.full_name}<br /><span style={{ fontSize: "0.75rem", color: "var(--steel)" }}>{ROLE_AR[u.role] ?? u.role}</span>
                  {u.role === "assistant" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button onClick={() => resetStaffPassword(u)} title="إعادة تعيين كلمة المرور" style={{ background: "none", border: "1px solid var(--fog-dark)", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}><KeyRound size={13} /></button>
                      <button onClick={() => removeStaff(u)} title="إزالة الموظف" style={{ background: "none", border: "1px solid var(--fog-dark)", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: "var(--red)" }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </td>
                {capabilities.map((c) => {
                  const granted = grants[u.id]?.has(c.key) ?? false;
                  const isOwnerAdmin = u.role === "owner" || u.role === "admin";
                  return (
                    <td key={c.key} style={{ textAlign: "center" }}>
                      {isOwnerAdmin ? (
                        <span title="يملك كل الصلاحيات تلقائياً" style={{ color: "var(--steel-light)", fontSize: "0.75rem" }}>—</span>
                      ) : (
                        <button
                          onClick={() => toggle(u.id, c.key, granted)}
                          style={{ width: 26, height: 26, borderRadius: 7, border: "1.5px solid var(--fog-dark)", background: granted ? "var(--green)" : "white", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          title={c.label_ar}
                        >
                          {granted && <Check size={15} color="white" />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div onClick={() => setShowAdd(false)} className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(27,42,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={createStaff} className="card" style={{ padding: "1.5rem", width: 420, maxWidth: "100%" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.05rem", color: "var(--navy)" }}>إضافة موظف</h3>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>اسم الموظف *</label>
            <input className="input" required value={staffName} onChange={(e) => setStaffName(e.target.value)} style={{ margin: "6px 0 12px" }} />
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>اسم المستخدم أو البريد الإلكتروني *</label>
            <input className="input" dir="ltr" required value={staffLogin} onChange={(e) => setStaffLogin(e.target.value)} placeholder="ali.office  أو  ali@company.com" style={{ margin: "6px 0 6px" }} />
            <p style={{ fontSize: "0.78rem", color: "var(--steel)", margin: "0 0 12px" }}>يُفضَّل البريد الإلكتروني الحقيقي لأنه تُستعاد به كلمة المرور. تُنشأ كلمة مرور مؤقتة تظهر لك مرة واحدة.</p>
            {staffMsg && !staffMsg.ok && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 10 }}>{staffMsg.text}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={staffBusy} className="btn btn-primary" style={{ flex: 1 }}>{staffBusy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {pendingWarning && (
        <div onClick={() => setPendingWarning(null)} className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(27,42,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: "1.5rem", width: 440, maxWidth: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={20} color="var(--red)" />
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--red)" }}>تنبيه من تعارض صلاحيات</h3>
            </div>
            {pendingWarning.messages.map((m, i) => (
              <p key={i} style={{ fontSize: "0.88rem", color: "#333", marginBottom: 8 }}>{m}</p>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => { applyGrant(pendingWarning.userId, pendingWarning.capKey); setPendingWarning(null); }}
                className="btn" style={{ background: "var(--red)", color: "white", flex: 1 }}
              >
                منح الصلاحية رغم التنبيه
              </button>
              <button onClick={() => setPendingWarning(null)} className="btn btn-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
