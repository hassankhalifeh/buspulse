"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

// Every indecent message or entry the system blocked. The record itself can never be edited or deleted;
// the fleet's owner/admin only adds a review decision and note (kept with their identity and time).
export default function WaViolationsPanel() {
  const [rows, setRows] = useState<Violation[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("wa_content_violations").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") query = query.eq("review_status", "pending");
    const { data, error: err } = await query;
    if (err) return setError("تعذّر تحميل المخالفات.");
    setError(null);
    setRows((data as Violation[]) ?? []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function review(id: number, status: Violation["review_status"]) {
    const note = window.prompt(status === "confirmed" ? "ملاحظة المراجعة (اختياري) — مثلاً الإجراء المتخذ:" : "سبب التجاهل (اختياري):") ?? undefined;
    if (note === undefined) return; // cancelled
    const { error: err } = await supabase.from("wa_content_violations").update({ review_status: status, review_note: note.trim() || null }).eq("id", id);
    if (err) return setError("تعذّر حفظ قرار المراجعة.");
    load();
  }

  const th: React.CSSProperties = { textAlign: "start", padding: "8px 6px", fontSize: "0.8rem", color: "var(--steel)", borderBottom: "1px solid var(--fog-dark, #ddd)" };
  const td: React.CSSProperties = { padding: "10px 6px", fontSize: "0.85rem", borderBottom: "1px solid var(--fog, #eee)", verticalAlign: "top" };

  return (
    <div>
      <p style={{ fontSize: "0.86rem", color: "var(--steel)", marginTop: 0 }}>
        أي رسالة أو إدخال يحتوي على ألفاظ غير لائقة يُمنع تلقائياً ويُسجَّل هنا بنصه الأصلي. السجل دائم ولا يُعدَّل ولا يُحذف؛ دورك تأكيد المخالفة أو تجاهلها مع ملاحظة تُحفظ باسمك ووقتها.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={`btn ${filter === "pending" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("pending")}>بانتظار المراجعة</button>
        <button className={`btn ${filter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("all")}>الكل</button>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.86rem" }}>{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><th style={th}>الوقت</th><th style={th}>الرقم</th><th style={th}>النوع</th><th style={th}>المحتوى</th><th style={th}>الإجراء</th><th style={th}>المراجعة</th></tr>
          </thead>
          <tbody>
            {rows.map((v) => (
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
            {rows.length === 0 && <tr><td style={td} colSpan={6}>لا توجد مخالفات {filter === "pending" ? "بانتظار المراجعة" : "مسجّلة"}. 👍</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
