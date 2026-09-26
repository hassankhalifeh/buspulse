"use client";

import { useEffect, useMemo, useState } from "react";
import { useTableKit } from "@/lib/tablekit";
import { supabase } from "@/lib/supabaseClient";
import type { WaPayment } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

interface RowWithNames extends WaPayment {
  student_name?: string;
  collector_name?: string;
}

// The literal "underpayment cascade" from the original bot design: a
// flagged shortfall sits here until the owner picks one of two paths.
// Both actions are simple status writes — the mirror trigger (file 2
// of the WhatsApp module SQL) picks up a Confirmed row automatically.
const PAY_STATUS_AR: Record<string, string> = { Pending: "معلّقة", Underpaid_Flagged: "ناقصة", Confirmed: "مؤكدة", Carried_Forward: "مرحّلة" };
const PAY_COLUMNS = [
  { key: "student_label", label: "الطالب" }, { key: "collector_label", label: "حصّلها" }, { key: "status_label", label: "الحالة" },
  { key: "amount_due", label: "المطلوب" }, { key: "amount_paid", label: "المدفوع" }, { key: "shortfall_amount", label: "النقص" },
];

export default function WaPaymentsPanel({ waTenantId }: { waTenantId: string }) {
  const [rows, setRows] = useState<RowWithNames[]>([]);
  const [filter, setFilter] = useState<"flagged" | "all">("flagged");

  // Search/filter plug-in (lib/tablekit) over what each card shows.
  const view = useMemo(() => rows.map((r) => ({
    ...r,
    student_label: r.student_name ?? "",
    collector_label: r.collector_name ?? "",
    status_label: PAY_STATUS_AR[r.status] ?? r.status,
  })), [rows]);
  const tk = useTableKit(view, PAY_COLUMNS);

  function load() {
    let query = supabase
      .from("wa_payments")
      .select("*, wa_students(student_name), wa_contacts!wa_payments_collected_by_contact_id_fkey(full_name)")
      .eq("wa_tenant_id", waTenantId)
      .order("created_at", { ascending: false });
    if (filter === "flagged") query = query.eq("status", "Underpaid_Flagged");

    query.then(({ data }) => {
      setRows(
        (data ?? []).map((r: any) => ({
          ...r,
          student_name: r.wa_students?.student_name,
          collector_name: r["wa_contacts"]?.full_name,
        }))
      );
    });
  }

  useEffect(() => { load(); }, [waTenantId, filter]);

  async function decide(id: string, decision: "Approved_Waive" | "Declined_Carry_Forward") {
    await supabase
      .from("wa_payments")
      .update({
        owner_decision: decision,
        status: decision === "Approved_Waive" ? "Confirmed" : "Carried_Forward",
      })
      .eq("id", id);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setFilter("flagged")} className="btn"
          style={{ background: filter === "flagged" ? "var(--navy)" : "white", color: filter === "flagged" ? "white" : "var(--steel)", border: "1.5px solid var(--fog-dark)", padding: "8px 18px" }}>
          الدفعات الناقصة فقط
        </button>
        <button onClick={() => setFilter("all")} className="btn"
          style={{ background: filter === "all" ? "var(--navy)" : "white", color: filter === "all" ? "white" : "var(--steel)", border: "1.5px solid var(--fog-dark)", padding: "8px 18px" }}>
          كل الدفعات
        </button>
      </div>

      {tk.toolbar}
      {tk.rows.length === 0 && <p style={{ color: "var(--steel)" }}>{rows.length === 0 ? "لا توجد سجلات." : "لا توجد نتائج مطابقة."}</p>}

      {tk.rows.map((r) => (
        <div key={r.id} className="card" style={{ padding: "1rem 1.2rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {r.status === "Underpaid_Flagged" && <AlertTriangle size={15} color="var(--red)" style={{ display: "inline", marginLeft: 6 }} />}
              {r.student_name ?? "طالب"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--steel)" }}>
              المطلوب: {r.amount_due} — المدفوع: {r.amount_paid}
              {r.shortfall_amount > 0 && <span style={{ color: "var(--red)", fontWeight: 700 }}> — النقص: {r.shortfall_amount}</span>}
              {r.collector_name && ` — حصّلها: ${r.collector_name}`}
            </p>
            <span className={`badge ${r.status === "Confirmed" ? "badge-active" : r.status === "Underpaid_Flagged" ? "badge-warning" : "badge-inactive"}`} style={{ marginTop: 6 }}>
              {r.status}
            </span>
          </div>

          {r.status === "Underpaid_Flagged" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => decide(r.id, "Approved_Waive")} className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "8px 14px" }}>
                قبول والتنازل عن الباقي
              </button>
              <button onClick={() => decide(r.id, "Declined_Carry_Forward")} className="btn" style={{ fontSize: "0.82rem", padding: "8px 14px", background: "var(--red)", color: "white" }}>
                ترحيل للشهر القادم
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
