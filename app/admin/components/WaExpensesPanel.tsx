"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { WaDriverExpense } from "@/lib/types";
import { ImageIcon, Check, X } from "lucide-react";

interface RowWithName extends WaDriverExpense { driver_name?: string; }
interface CashOwedRow { driver_contact_id: string; total_collected: number; approved_expenses: number; net_cash_owed: number; wa_contacts?: { full_name: string }; }

export default function WaExpensesPanel({ waTenantId }: { waTenantId: string }) {
  const [expenses, setExpenses] = useState<RowWithName[]>([]);
  const [cashOwed, setCashOwed] = useState<CashOwedRow[]>([]);

  function load() {
    supabase
      .from("wa_driver_expenses")
      .select("*, wa_contacts(full_name)")
      .eq("wa_tenant_id", waTenantId)
      .order("expense_date", { ascending: false })
      .then(({ data }) => {
        setExpenses((data ?? []).map((r: any) => ({ ...r, driver_name: r.wa_contacts?.full_name })));
      });

    supabase
      .from("v_wa_driver_cash_owed")
      .select("*, wa_contacts(full_name)")
      .eq("wa_tenant_id", waTenantId)
      .then(({ data }) => setCashOwed((data as any) ?? []));
  }

  useEffect(() => { load(); }, [waTenantId]);

  async function setStatus(id: string, status: "Approved" | "Rejected") {
    await supabase.from("wa_driver_expenses").update({ status }).eq("id", id);
    load();
  }

  return (
    <div>
      {/* The balancing equation from the original design, computed
          live by v_wa_driver_cash_owed — never a stored number that
          can drift out of sync. */}
      {cashOwed.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {cashOwed.map((c) => (
            <div key={c.driver_contact_id} className="card" style={{ padding: "14px 18px", minWidth: 200 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>{c.wa_contacts?.full_name ?? "سائق"}</p>
              <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--steel)" }}>
                حصّل: {c.total_collected} — مصاريف معتمدة: {c.approved_expenses}
              </p>
              <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: "1.2rem", color: c.net_cash_owed >= 0 ? "var(--navy)" : "var(--red)" }}>
                الصافي المستحق: {c.net_cash_owed}
              </p>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: "1.05rem", marginBottom: 10 }}>مصاريف بانتظار المراجعة</h3>
      {expenses.filter((e) => e.status === "Pending").length === 0 && (
        <p style={{ color: "var(--steel)", marginBottom: 20 }}>لا توجد مصاريف بانتظار المراجعة.</p>
      )}
      {expenses.filter((e) => e.status === "Pending").map((e) => (
        <div key={e.id} className="card" style={{ padding: "1rem 1.2rem", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{e.driver_name ?? "سائق"} — {e.category ?? "مصروف"}</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--steel)" }}>
              {e.expense_date} — المبلغ: {e.amount}
            </p>
            <a href={e.receipt_photo_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "var(--navy)", marginTop: 6 }}>
              <ImageIcon size={14} /> عرض إثبات الصورة
            </a>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStatus(e.id, "Approved")} className="btn btn-secondary" style={{ fontSize: "0.82rem", padding: "8px 14px", color: "var(--green)" }}>
              <Check size={14} /> اعتماد
            </button>
            <button onClick={() => setStatus(e.id, "Rejected")} className="btn" style={{ fontSize: "0.82rem", padding: "8px 14px", background: "var(--red)", color: "white" }}>
              <X size={14} /> رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
