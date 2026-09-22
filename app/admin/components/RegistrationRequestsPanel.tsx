"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface RequestRow {
  id: string;
  fleet_id: string;
  full_name: string;
  phone: string;
  school_name: string | null;
  address: string | null;
  status: string;
  created_at: string;
  children: { child_name: string; relation: string }[];
}

export default function RegistrationRequestsPanel() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: reqs } = await supabase.from("registration_requests").select("*").order("created_at", { ascending: false });
    const { data: children } = await supabase.from("registration_request_children").select("*");
    const merged = (reqs ?? []).map((r) => ({
      ...r,
      children: (children ?? []).filter((c) => c.request_id === r.id),
    }));
    setRequests(merged);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("registration_requests").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) { alert(error.message); return; }

    if (status === "approved") {
      const request = requests.find((r) => r.id === id);
      if (request) {
        // إنشاء ولي أمر حقيقي فوراً، بنفس أسطول الطلب (لا نخمّنه من جدول الأساطيل)
        const { data: guardian, error: gErr } = await supabase.from("guardians")
          .insert({ full_name: request.full_name, phone: request.phone, address: request.address, fleet_id: request.fleet_id })
          .select("guardian_id")
          .single();
        if (gErr) { alert("تمت الموافقة لكن فشل إنشاء ولي الأمر: " + gErr.message); }
        else {
          // توليد QR مباشرة له
          await supabase.functions.invoke("generate-qr", { body: { entity_type: "guardian", entity_id: guardian!.guardian_id } });
          alert(`تم إنشاء حساب ولي الأمر وتوليد رمز الدخول له. يمكنك أخذ الرابط من قسم "أولياء الأمور".`);
        }
      }
    }
    load();
  }

  if (loading) return <p style={{ color: "var(--steel)" }}>جارٍ التحميل...</p>;

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <h3 style={{ marginBottom: 12 }}>طلبات بانتظار المراجعة ({pending.length})</h3>
      {pending.length === 0 && <p style={{ color: "var(--steel)", marginBottom: 20 }}>لا توجد طلبات معلَّقة حالياً.</p>}
      {pending.map((r) => (
        <div key={r.id} className="card" style={{ padding: "1rem", marginBottom: 12 }}>
          <p style={{ fontWeight: 700 }}>{r.full_name} — {r.phone}</p>
          {r.school_name && <p style={{ fontSize: "0.85rem", color: "var(--steel)" }}>المدرسة: {r.school_name}</p>}
          {r.address && <p style={{ fontSize: "0.85rem", color: "var(--steel)" }}>العنوان: {r.address}</p>}
          {r.children.length > 0 && (
            <ul style={{ fontSize: "0.85rem", margin: "8px 0" }}>
              {r.children.map((c, i) => <li key={i}>{c.child_name} ({c.relation})</li>)}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => decide(r.id, "approved")} className="btn" style={{ background: "var(--green)", color: "white" }}>
              <CheckCircle2 size={16} /> موافقة
            </button>
            <button onClick={() => decide(r.id, "rejected")} className="btn" style={{ background: "var(--red)", color: "white" }}>
              <XCircle size={16} /> رفض
            </button>
          </div>
        </div>
      ))}

      {others.length > 0 && (
        <>
          <h3 style={{ margin: "20px 0 12px" }}>طلبات سابقة</h3>
          {others.map((r) => (
            <div key={r.id} className="card" style={{ padding: "0.85rem", marginBottom: 8, opacity: 0.7 }}>
              <p>{r.full_name} — {r.phone} — {r.status === "approved" ? "✅ موافَق" : "❌ مرفوض"}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
