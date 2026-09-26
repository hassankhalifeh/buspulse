"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTableKit } from "@/lib/tablekit";

interface Violation {
  id: number;
  contact_id: string | null;
  phone_number: string | null;
  direction: "inbound" | "outbound" | "stored";
  context: string;
  content: string;
  matched_terms: string[];
  categories: string[];
  action_taken: "blocked" | "masked";
  created_at: string;
  review_status: "pending" | "confirmed" | "dismissed";
  review_note: string | null;
  reviewed_at: string | null;
}

const DIRECTION: Record<Violation["direction"], string> = { inbound: "رسالة واردة", outbound: "رسالة صادرة من البوت", stored: "بيانات مُدخلة" };
const ACTION: Record<Violation["action_taken"], string> = { blocked: "مُنعت", masked: "أُخفي المحتوى" };
const STATUS: Record<Violation["review_status"], { text: string; color: string }> = {
  pending: { text: "بانتظار المراجعة", color: "#8A5A00" },
  confirmed: { text: "مخالفة مؤكَّدة", color: "var(--red)" },
  dismissed: { text: "لا مخالفة (تجاهل)", color: "var(--steel)" },
};

const VIOLATION_COLUMNS = [
  { key: "time", label: "الوقت" }, { key: "phone", label: "الرقم" }, { key: "type", label: "النوع" },
  { key: "content", label: "المحتوى" }, { key: "action", label: "الإجراء" }, { key: "review", label: "المراجعة" },
];
function violationText(v: Violation, key: string): string {
  switch (key) {
    case "time": return new Date(v.created_at).toLocaleString("ar");
    case "phone": return v.phone_number ?? "";
    case "type": return `${DIRECTION[v.direction]} ${v.context}`;
    case "content": return `${v.content} ${v.matched_terms.join(" ")}`;
    case "action": return ACTION[v.action_taken];
    case "review": return `${STATUS[v.review_status].text} ${v.review_note ?? ""}`;
    default: return "";
  }
}

// Every indecent message or entry the system blocked. The record itself can never be edited or deleted;
// the fleet's owner/admin only adds a review decision and note (kept with their identity and time).
export default function WaViolationsPanel() {
  const [rows, setRows] = useState<Violation[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);
  const tk = useTableKit(rows, VIOLATION_COLUMNS, { getText: violationText });

  const load = useCallback(async () => {
    let query = supabase.from("wa_content_violations").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") query = query.eq("review_status", "pending");
    const { data, error: err } = await query;
    if (err) return setError("تعذّر تحميل المخالفات.");
    setError(null);
    setRows((data as Violation[]) ?? []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ---- temporary mute: settings + who is muted now (one-click lift) ----
  const [mute, setMute] = useState<{ id: string; mute_threshold: number; mute_days: number } | null>(null);
  const [muteForm, setMuteForm] = useState({ mute_threshold: 3, mute_days: 7 });
  const [muted, setMuted] = useState<{ id: string; full_name: string | null; phone_number: string; muted_until: string }[]>([]);
  const [muteMsg, setMuteMsg] = useState<string | null>(null);

  const loadMute = useCallback(async () => {
    const { data: t } = await supabase.from("wa_tenants").select("id, mute_threshold, mute_days").limit(1).maybeSingle();
    if (t) {
      setMute(t as any);
      setMuteForm({ mute_threshold: t.mute_threshold, mute_days: t.mute_days });
    }
    const { data: c } = await supabase.from("wa_contacts").select("id, full_name, phone_number, muted_until").gt("muted_until", new Date().toISOString()).order("muted_until");
    setMuted((c as any[]) ?? []);
  }, []);

  useEffect(() => { loadMute(); }, [loadMute]);

  async function saveMuteSettings() {
    if (!mute) return;
    setMuteMsg(null);
    const { error: err } = await supabase.from("wa_tenants").update(muteForm).eq("id", mute.id);
    setMuteMsg(err ? "تعذّر حفظ الإعداد (الحد 1–20 والأيام 1–90)." : "تم حفظ إعداد الكتم ✓");
    if (!err) loadMute();
  }

  async function unmute(contactId: string) {
    const { data } = await supabase.rpc("wa_unmute_contact", { p_contact_id: contactId });
    setMuteMsg(data === true ? "أُلغي الكتم ✓ (يبدأ العدّ من جديد)" : "تعذّر إلغاء الكتم.");
    loadMute();
  }

  async function review(id: number, status: Violation["review_status"]) {
    const note = window.prompt(status === "confirmed" ? "ملاحظة المراجعة (اختياري) — مثلاً الإجراء المتخذ:" : "سبب التجاهل (اختياري):") ?? undefined;
    if (note === undefined) return; // cancelled
    const { error: err } = await supabase.from("wa_content_violations").update({ review_status: status, review_note: note.trim() || null }).eq("id", id);
    if (err) return setError("تعذّر حفظ قرار المراجعة.");
    load();
    loadMute(); // a confirmation may have just muted the person
  }

  const th: React.CSSProperties = { textAlign: "start", padding: "8px 6px", fontSize: "0.8rem", color: "var(--steel)", borderBottom: "1px solid var(--fog-dark, #ddd)" };
  const td: React.CSSProperties = { padding: "10px 6px", fontSize: "0.85rem", borderBottom: "1px solid var(--fog, #eee)", verticalAlign: "top" };

  return (
    <div>
      <p style={{ fontSize: "0.86rem", color: "var(--steel)", marginTop: 0 }}>
        أي رسالة أو إدخال يحتوي على ألفاظ غير لائقة يُمنع تلقائياً ويُسجَّل هنا بنصه الأصلي. السجل دائم ولا يُعدَّل ولا يُحذف؛ دورك تأكيد المخالفة أو تجاهلها مع ملاحظة تُحفظ باسمك ووقتها.
      </p>
      <div style={{ padding: 14, borderRadius: 10, background: "var(--fog, #f3f5f7)", marginBottom: 14 }}>
        <strong style={{ fontSize: "0.9rem" }}>الكتم المؤقت لأولياء الأمور</strong>
        <p style={{ fontSize: "0.82rem", color: "var(--steel)", margin: "4px 0 8px" }}>
          لا يُكتم أحد بالاكتشاف الآلي وحده: يبدأ الكتم فقط بعد أن <b>تؤكّد أنت</b> عدداً من المخالفات الواردة من الشخص خلال 30 يوماً، ويتوقف البوت عن التفاعل مع رسائله للمدة المحددة، ثم يعود تلقائياً. لا يشمل السائقين أبداً (تسجيل الرحلة والطوارئ).
        </p>
        {mute && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.82rem" }}>عدد المخالفات المؤكَّدة للكتم
              <input className="input" type="number" min={1} max={20} style={{ display: "block", width: 110, marginTop: 4 }} value={muteForm.mute_threshold} onChange={(e) => setMuteForm({ ...muteForm, mute_threshold: Number(e.target.value) })} />
            </label>
            <label style={{ fontSize: "0.82rem" }}>مدة الكتم (أيام)
              <input className="input" type="number" min={1} max={90} style={{ display: "block", width: 110, marginTop: 4 }} value={muteForm.mute_days} onChange={(e) => setMuteForm({ ...muteForm, mute_days: Number(e.target.value) })} />
            </label>
            <button className="btn btn-primary" onClick={saveMuteSettings}>حفظ</button>
          </div>
        )}
        {muteMsg && <p style={{ fontSize: "0.84rem", margin: "8px 0 0" }}>{muteMsg}</p>}
        <div style={{ marginTop: 10, fontSize: "0.86rem" }}>
          <strong>المكتومون حالياً ({muted.length})</strong>
          {muted.length === 0 ? <span style={{ color: "var(--steel)" }}> — لا أحد.</span> : (
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 0, listStyle: "none" }}>
              {muted.map((m) => (
                <li key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0" }}>
                  <span>{m.full_name ?? "—"} <span dir="ltr" style={{ color: "var(--steel)" }}>{m.phone_number}</span> — حتى {new Date(m.muted_until).toLocaleDateString("ar")}</span>
                  <button className="btn btn-secondary" onClick={() => unmute(m.id)}>إلغاء الكتم</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={`btn ${filter === "pending" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("pending")}>بانتظار المراجعة</button>
        <button className={`btn ${filter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("all")}>الكل</button>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.86rem" }}>{error}</p>}
      {tk.toolbar}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><th style={th}>الوقت</th><th style={th}>الرقم</th><th style={th}>النوع</th><th style={th}>المحتوى</th><th style={th}>الإجراء</th><th style={th}>المراجعة</th></tr>
          </thead>
          <tbody>
            {tk.rows.map((v) => (
              <tr key={v.id}>
                <td style={td}>{new Date(v.created_at).toLocaleString("ar")}</td>
                <td style={td} dir="ltr">{v.phone_number ?? "—"}</td>
                <td style={td}>{DIRECTION[v.direction]}<div style={{ fontSize: "0.74rem", color: "var(--steel)" }}>{v.context}</div></td>
                <td style={{ ...td, maxWidth: 280, wordBreak: "break-word" }}>{v.content}<div style={{ fontSize: "0.74rem", color: "var(--red)" }}>{v.matched_terms.join("، ")}</div></td>
                <td style={td}>{ACTION[v.action_taken]}</td>
                <td style={td}>
                  <div style={{ color: STATUS[v.review_status].color, fontWeight: 600 }}>{STATUS[v.review_status].text}</div>
                  {v.review_note && <div style={{ fontSize: "0.78rem" }}>{v.review_note}</div>}
                  {v.reviewed_at && <div style={{ fontSize: "0.72rem", color: "var(--steel)" }}>{new Date(v.reviewed_at).toLocaleString("ar")}</div>}
                  {v.review_status === "pending" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button className="btn btn-primary" onClick={() => review(v.id, "confirmed")}>تأكيد</button>
                      <button className="btn btn-secondary" onClick={() => review(v.id, "dismissed")}>تجاهل</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {tk.rows.length === 0 && <tr><td style={td} colSpan={6}>لا توجد مخالفات {filter === "pending" ? "بانتظار المراجعة" : "مسجّلة"}. 👍</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
