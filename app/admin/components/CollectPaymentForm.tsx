"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Wallet, CheckCircle2 } from "lucide-react";

interface StudentOption { student_id: string; full_name: string; contract_id: string; }

export default function CollectPaymentForm({ busId }: { busId: string }) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("students").select("student_id, full_name, contract_id").eq("bus_id", busId)
      .then(({ data }) => setStudents(data ?? []));
  }, [busId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!studentId) { setError("اختر الطالب."); return; }
    if (!amt || amt <= 0) { setError("أدخل مبلغاً صحيحاً."); return; }

    const student = students.find((s) => s.student_id === studentId);
    setSubmitting(true);
    const { error: err } = await supabase.from("payments").insert({
      payment_id: `PAY-${Date.now()}`,
      student_id: studentId,
      contract_id: student?.contract_id,
      amount: amt,
      payment_method: "Cash",
      payment_status: "Pending",
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setStudentId("");
    setAmount("");
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={submit} className="card fade-in" style={{ padding: "1.2rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Wallet size={20} color="var(--navy)" />
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>تسجيل قبض دفعة</h3>
      </div>

      <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input" style={{ marginBottom: 10 }}>
        <option value="">— اختر الطالب —</option>
        {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
      </select>

      <input type="number" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" style={{ marginBottom: 14 }} />

      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}

      <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
        {submitting ? "جارٍ الحفظ..." : saved ? <><CheckCircle2 size={16} /> تم التسجيل ✓</> : "تسجيل القبض"}
      </button>
    </form>
  );
}
