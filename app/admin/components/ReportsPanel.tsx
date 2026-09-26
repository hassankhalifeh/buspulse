"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { useAppUser } from "@/lib/useAppUser";
import { useTableKit } from "@/lib/tablekit";
import { FileSpreadsheet, Printer, CheckCircle2 } from "lucide-react";

type Row = Record<string, string | number | null>;
interface Piece { heading: string; columns: { key: string; label: string }[]; rows: Row[] }
type Category = "الأشخاص" | "الحافلات والمسارات" | "الدفعات والحسابات" | "السجلات";

const CONTRACT_TYPE: Record<string, string> = { Trip_Based: "مساري (رحلات)", Non_Trip_Lease: "تأجير حر" };
const PAYMENT_CYCLE: Record<string, string> = { Monthly_Fixed: "شهري ثابت", Full_Upfront: "كامل مقدماً", Installments: "أقساط" };
const CONTRACT_STATUS: Record<string, string> = { Active: "نشط", Completed: "منتهٍ", Cancelled: "ملغى" };
const BUS_STATUS: Record<string, string> = { Active: "نشطة", In_Maintenance: "تحت الصيانة", Retired: "خارج الخدمة" };
const DRIVER_STATUS: Record<string, string> = { Active: "نشط", Inactive: "غير نشط" };
const PAY_METHOD: Record<string, string> = { Cash: "كاش", Digital: "رقمي" };
const PAY_STATUS: Record<string, string> = { Pending: "بانتظار التسليم للإدارة", Confirmed: "تم التسليم والتأكيد" };
const SHIFT: Record<string, string> = { Morning: "صباحي", Evening: "مسائي" };

interface BlockDef {
  key: string;
  label: string;
  category: Category;
  param?: "route" | "bus";
}

const BLOCKS: BlockDef[] = [
  { key: "guardians", label: "أولياء الأمور", category: "الأشخاص" },
  { key: "studentsByGuardian", label: "الطلاب حسب ولي الأمر", category: "الأشخاص" },
  { key: "drivers", label: "السائقون", category: "الأشخاص" },
  { key: "buses", label: "الحافلات", category: "الحافلات والمسارات" },
  { key: "studentsByRoute", label: "طلاب مسار وحافلة محدَّدة", category: "الحافلات والمسارات", param: "route" },
  { key: "busDailyRoster", label: "كشف طلاب حافلة معيّنة", category: "الحافلات والمسارات", param: "bus" },
  { key: "contracts", label: "العقود ودورة الدفع", category: "الدفعات والحسابات" },
  { key: "paymentsBreakdown", label: "الدفعات: التصنيف والمجاميع والمتبقي", category: "الدفعات والحسابات" },
  { key: "monthlyPL", label: "الأرباح والخسائر الشهرية", category: "الدفعات والحسابات" },
  { key: "handoverLog", label: "سجل استلام الحافلات", category: "السجلات" },
];

// One report table with the search/filter plug-in. The rows that remain after filtering are
// reported upward so "تصدير Excel" exports what is on screen (print already follows the DOM).
function PieceTable({ piece, pieceId, onRows }: { piece: Piece; pieceId: string; onRows: (id: string, rows: Row[]) => void }) {
  const tk = useTableKit(piece.rows, piece.columns);
  useEffect(() => { onRows(pieceId, tk.rows); }, [tk.rows, pieceId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {tk.toolbar}
      <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead><tr>{piece.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {tk.rows.map((r, ri) => <tr key={ri}>{piece.columns.map((c) => <td key={c.key}>{r[c.key] ?? "—"}</td>)}</tr>)}
          {tk.rows.length === 0 && <tr><td colSpan={piece.columns.length}>{piece.rows.length === 0 ? "لا توجد بيانات." : "لا توجد نتائج مطابقة."}</td></tr>}
        </tbody>
      </table>
      </div>
    </>
  );
}

function sheetName(s: string) {
  return s.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "sheet";
}

// One flexible page instead of one screen per report: tick the blocks you want, set any
// parameter they need, and both "توليد" and the exports work on exactly that selection —
// so a report someone rarely needs never has to be its own permanent page.
export default function ReportsPanel() {
  const { appUser } = useAppUser();
  const [selected, setSelected] = useState<Set<string>>(new Set(["guardians"]));
  const [routes, setRoutes] = useState<{ value: string; label: string }[]>([]);
  const [buses, setBuses] = useState<{ value: string; label: string }[]>([]);
  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ key: string; label: string; pieces: Piece[] }[]>([]);
  const [pendingPayments, setPendingPayments] = useState<{ id: string; student: string; driver: string; amount: number }[]>([]);
  const [confirmBusy, setConfirmBusy] = useState<string | null>(null);
  const filteredRows = useRef<Record<string, Row[]>>({});

  useEffect(() => {
    supabase.from("routes").select("route_id, route_name, buses(plate_number)").order("route_name").then(({ data }) => {
      const opts = (data ?? []).map((r: any) => ({ value: r.route_id, label: r.buses?.plate_number ? `${r.route_name} — حافلة ${r.buses.plate_number}` : r.route_name }));
      setRoutes(opts);
      if (opts.length > 0) setRouteId((v) => v || opts[0].value);
    });
    supabase.from("buses").select("bus_id, plate_number").order("plate_number").then(({ data }) => {
      const opts = (data ?? []).map((b) => ({ value: b.bus_id, label: b.plate_number }));
      setBuses(opts);
      if (opts.length > 0) setBusId((v) => v || opts[0].value);
    });
  }, []);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function loadPendingPayments() {
    const { data } = await supabase
      .from("payments")
      .select("payment_id, amount, students(full_name), drivers(full_name)")
      .eq("payment_status", "Pending")
      .order("payment_date", { ascending: false });
    setPendingPayments((data ?? []).map((p: any) => ({
      id: p.payment_id, amount: p.amount, student: p.students?.full_name ?? "—", driver: p.drivers?.full_name ?? "غير محدَّد",
    })));
  }

  async function confirmPayment(paymentId: string) {
    if (!appUser) return;
    setConfirmBusy(paymentId);
    const { error: err } = await supabase.from("payments")
      .update({ payment_status: "Confirmed", confirmed_by: appUser.full_name, confirmed_at: new Date().toISOString() })
      .eq("payment_id", paymentId);
    setConfirmBusy(null);
    if (err) { setError(err.message); return; }
    loadPendingPayments();
    if (selected.has("paymentsBreakdown")) generate();
  }

  async function loadBlock(key: string): Promise<{ key: string; label: string; pieces: Piece[] } | null> {
    const def = BLOCKS.find((b) => b.key === key)!;

    if (key === "guardians") {
      const { data, error: err } = await supabase.from("guardians").select("full_name, phone, email, address").order("full_name");
      if (err) throw err;
      return { key, label: def.label, pieces: [{
        heading: "أولياء الأمور",
        columns: [{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "email", label: "البريد الإلكتروني" }, { key: "address", label: "العنوان" }],
        rows: data ?? [],
      }] };
    }

    if (key === "studentsByGuardian") {
      const { data, error: err } = await supabase.from("students").select("full_name, guardians(full_name, phone)").order("guardian_id");
      if (err) throw err;
      const rows = (data ?? [])
        .map((s: any) => ({ guardian_name: s.guardians?.full_name ?? "—", guardian_phone: s.guardians?.phone ?? "—", student_name: s.full_name }))
        .sort((a: any, b: any) => a.guardian_name.localeCompare(b.guardian_name, "ar"));
      return { key, label: def.label, pieces: [{
        heading: "الطلاب حسب ولي الأمر",
        columns: [{ key: "guardian_name", label: "ولي الأمر" }, { key: "guardian_phone", label: "هاتف ولي الأمر" }, { key: "student_name", label: "اسم الطالب" }],
        rows,
      }] };
    }

    if (key === "drivers") {
      const { data, error: err } = await supabase.from("drivers").select("full_name, phone, license_number, status").order("full_name");
      if (err) throw err;
      const rows = (data ?? []).map((d) => ({ ...d, status: DRIVER_STATUS[d.status as string] ?? d.status }));
      return { key, label: def.label, pieces: [{
        heading: "السائقون",
        columns: [{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "license_number", label: "رقم الرخصة" }, { key: "status", label: "الحالة" }],
        rows,
      }] };
    }

    if (key === "buses") {
      const { data, error: err } = await supabase.from("buses").select("plate_number, model, manufacture_year, capacity, status, drivers(full_name)").order("plate_number");
      if (err) throw err;
      const rows = (data ?? []).map((b: any) => ({ plate_number: b.plate_number, model: b.model, manufacture_year: b.manufacture_year, capacity: b.capacity, status: BUS_STATUS[b.status] ?? b.status, driver_name: b.drivers?.full_name ?? "—" }));
      return { key, label: def.label, pieces: [{
        heading: "الحافلات",
        columns: [{ key: "plate_number", label: "اللوحة" }, { key: "model", label: "الموديل" }, { key: "manufacture_year", label: "سنة الصنع" }, { key: "capacity", label: "عدد المقاعد" }, { key: "status", label: "الحالة" }, { key: "driver_name", label: "السائق الحالي" }],
        rows,
      }] };
    }

    if (key === "studentsByRoute") {
      if (!routeId) return { key, label: def.label, pieces: [{ heading: "طلاب المسار", columns: [], rows: [] }] };
      const { data, error: err } = await supabase
        .from("student_route_stops")
        .select("students(full_name, guardians(phone)), route_stops(stop_name, stop_order)")
        .eq("route_id", routeId);
      if (err) throw err;
      const rows = (data ?? [])
        .map((r: any) => ({ student_name: r.students?.full_name ?? "—", guardian_phone: r.students?.guardians?.phone ?? "—", stop_name: r.route_stops?.stop_name ?? "—", stop_order: r.route_stops?.stop_order ?? 0 }))
        .sort((a: any, b: any) => a.stop_order - b.stop_order);
      const routeLabel = routes.find((r) => r.value === routeId)?.label ?? "";
      return { key, label: def.label, pieces: [{
        heading: `طلاب مسار «${routeLabel}»`,
        columns: [{ key: "student_name", label: "اسم الطالب" }, { key: "guardian_phone", label: "هاتف ولي الأمر" }, { key: "stop_name", label: "نقطة التوقف" }],
        rows,
      }] };
    }

    if (key === "busDailyRoster") {
      if (!busId) return { key, label: def.label, pieces: [{ heading: "كشف الحافلة", columns: [], rows: [] }] };
      const { data, error: err } = await supabase.from("students").select("full_name, pickup_location, guardians(phone)").eq("bus_id", busId).order("full_name");
      if (err) throw err;
      const rows = (data ?? []).map((s: any) => ({ full_name: s.full_name, pickup_location: s.pickup_location ?? "—", guardian_phone: s.guardians?.phone ?? "—" }));
      const busLabel = buses.find((b) => b.value === busId)?.label ?? "";
      return { key, label: def.label, pieces: [{
        heading: `كشف طلاب حافلة ${busLabel}`,
        columns: [{ key: "full_name", label: "اسم الطالب" }, { key: "pickup_location", label: "موقع الالتقاط" }, { key: "guardian_phone", label: "هاتف ولي الأمر" }],
        rows,
      }] };
    }

    if (key === "contracts") {
      const { data, error: err } = await supabase.from("contracts").select("client_name, contract_type, period_label, payment_cycle, total_contract_value, status").order("client_name");
      if (err) throw err;
      const rows = (data ?? []).map((c) => ({
        client_name: c.client_name, contract_type: CONTRACT_TYPE[c.contract_type as string] ?? c.contract_type,
        period_label: c.period_label, payment_cycle: PAYMENT_CYCLE[c.payment_cycle as string] ?? c.payment_cycle,
        total_contract_value: c.total_contract_value ?? "—", status: CONTRACT_STATUS[c.status as string] ?? c.status,
      }));
      return { key, label: def.label, pieces: [{
        heading: "العقود",
        columns: [{ key: "client_name", label: "العميل" }, { key: "contract_type", label: "النوع" }, { key: "period_label", label: "الفترة" }, { key: "payment_cycle", label: "دورة الدفع" }, { key: "total_contract_value", label: "القيمة الإجمالية" }, { key: "status", label: "الحالة" }],
        rows,
      }] };
    }

    if (key === "monthlyPL") {
      const { data, error: err } = await supabase.from("v_bus_monthly_pl").select("*").order("month", { ascending: false }).limit(50);
      if (err) throw err;
      return { key, label: def.label, pieces: [{
        heading: "الأرباح والخسائر الشهرية لكل حافلة",
        columns: [{ key: "plate_number", label: "الحافلة" }, { key: "month", label: "الشهر" }, { key: "subscription_revenue", label: "الإيرادات" }, { key: "maintenance_cost", label: "الصيانة" }, { key: "driver_payroll_cost", label: "الأجور" }, { key: "net_profit", label: "الصافي" }],
        rows: data ?? [],
      }] };
    }

    if (key === "handoverLog") {
      const { data, error: err } = await supabase
        .from("handover_log")
        .select("handover_date, shift_type, buses(plate_number), drivers(full_name), checklist_tires_ok, checklist_lights_ok, checklist_brakes_ok, checklist_cleanliness_ok, damage_notes")
        .order("handover_date", { ascending: false })
        .limit(200);
      if (err) throw err;
      const rows = (data ?? []).map((h: any) => {
        const issues = [
          !h.checklist_tires_ok && "الإطارات", !h.checklist_lights_ok && "الأضواء",
          !h.checklist_brakes_ok && "الفرامل", !h.checklist_cleanliness_ok && "النظافة",
        ].filter(Boolean) as string[];
        return {
          handover_date: h.handover_date, shift_type: SHIFT[h.shift_type] ?? h.shift_type,
          plate_number: h.buses?.plate_number ?? "—", driver_name: h.drivers?.full_name ?? "—",
          checklist: issues.length === 0 ? "سليم" : `ملاحظات: ${issues.join("، ")}`,
          damage_notes: h.damage_notes || "—",
        };
      });
      return { key, label: def.label, pieces: [{
        heading: "سجل استلام الحافلات",
        columns: [{ key: "handover_date", label: "التاريخ" }, { key: "shift_type", label: "الدوام" }, { key: "plate_number", label: "الحافلة" }, { key: "driver_name", label: "السائق" }, { key: "checklist", label: "الفحص" }, { key: "damage_notes", label: "ملاحظات أضرار" }],
        rows,
      }] };
    }

    if (key === "paymentsBreakdown") {
      const [{ data: payments, error: pErr }, { data: contracts, error: cErr }] = await Promise.all([
        supabase.from("payments").select("payment_id, contract_id, amount, payment_method, payment_status, payment_date, students(full_name), drivers(full_name)").order("payment_date", { ascending: false }),
        supabase.from("contracts").select("contract_id, client_name, total_contract_value, students(full_name)"),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;

      const all = payments ?? [];
      const detailRows = all.map((p: any) => ({
        payment_date: p.payment_date, student_name: p.students?.full_name ?? "—", driver_name: p.drivers?.full_name ?? "—",
        payment_method: PAY_METHOD[p.payment_method as string] ?? p.payment_method, payment_status: PAY_STATUS[p.payment_status as string] ?? p.payment_status,
        amount: p.amount,
      }));

      const sum = (xs: any[]) => xs.reduce((s, p) => s + Number(p.amount || 0), 0);
      const totalAll = sum(all);
      const totalPending = sum(all.filter((p: any) => p.payment_status === "Pending"));
      const totalConfirmed = sum(all.filter((p: any) => p.payment_status === "Confirmed"));

      const totalsRows = [
        { label: "إجمالي ما دفعه الطلاب (كل الحالات)", amount: totalAll },
        { label: "بانتظار التسليم للإدارة (لا يزال مع السائقين)", amount: totalPending },
        { label: "تم تسليمه وتأكيده لدى الإدارة", amount: totalConfirmed },
      ];

      const byDriver = new Map<string, number>();
      all.filter((p: any) => p.payment_status === "Pending").forEach((p: any) => {
        const name = p.drivers?.full_name ?? "غير محدَّد (دُفعت قبل ربط السائق)";
        byDriver.set(name, (byDriver.get(name) ?? 0) + Number(p.amount || 0));
      });
      const driverRows = Array.from(byDriver.entries()).map(([driver_name, amount]) => ({ driver_name, amount }));

      const paidByContract = new Map<string, number>();
      all.forEach((p: any) => {
        if (p.contract_id) paidByContract.set(p.contract_id, (paidByContract.get(p.contract_id) ?? 0) + Number(p.amount || 0));
      });

      const remainingRows = (contracts ?? [])
        .filter((c: any) => c.total_contract_value !== null && c.total_contract_value !== undefined)
        .map((c: any) => {
          const studentNames = (c.students ?? []).map((s: any) => s.full_name).join("، ") || "—";
          const paid = paidByContract.get(c.contract_id) ?? 0;
          return { client_name: c.client_name, student_name: studentNames, total_value: c.total_contract_value, paid, remaining: Number(c.total_contract_value) - paid };
        });

      return {
        key, label: def.label,
        pieces: [
          { heading: "تفصيل كل الدفعات", columns: [{ key: "payment_date", label: "التاريخ" }, { key: "student_name", label: "الطالب" }, { key: "driver_name", label: "السائق" }, { key: "payment_method", label: "طريقة الدفع" }, { key: "payment_status", label: "الحالة" }, { key: "amount", label: "المبلغ" }], rows: detailRows },
          { heading: "الإجماليات", columns: [{ key: "label", label: "البند" }, { key: "amount", label: "المبلغ" }], rows: totalsRows },
          { heading: "المبلغ العالق مع كل سائق (لم يُسلَّم بعد)", columns: [{ key: "driver_name", label: "السائق" }, { key: "amount", label: "المبلغ العالق" }], rows: driverRows.length ? driverRows : [{ driver_name: "لا يوجد مبلغ عالق", amount: 0 }] },
          { heading: "المتبقي على الطلاب حسب العقد (للعقود ذات قيمة محدَّدة)", columns: [{ key: "client_name", label: "العميل" }, { key: "student_name", label: "الطالب" }, { key: "total_value", label: "قيمة العقد" }, { key: "paid", label: "المدفوع حتى الآن" }, { key: "remaining", label: "المتبقي" }], rows: remainingRows },
        ],
      };
    }

    return null;
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(Array.from(selected).map((k) => loadBlock(k)));
      setBlocks(results.filter(Boolean) as any);
      if (selected.has("paymentsBreakdown")) await loadPendingPayments();
    } catch (e: any) {
      setError(e?.message ?? "تعذّر تحميل التقرير");
    }
    setLoading(false);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    let n = 0;
    blocks.forEach((b, bi) => b.pieces.forEach((p, pi) => {
      if (p.columns.length === 0) return;
      const shown = filteredRows.current[`${bi}-${pi}`] ?? p.rows; // what the search/filter left on screen
      const sheet = XLSX.utils.json_to_sheet(shown.map((r) => Object.fromEntries(p.columns.map((c) => [c.label, r[c.key] ?? ""]))));
      XLSX.utils.book_append_sheet(wb, sheet, sheetName(`${++n}-${p.heading}`));
    }));
    XLSX.writeFile(wb, "تقرير.xlsx");
  }

  function exportPdf() {
    document.body.classList.add("printing-report");
    window.print();
    const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 2000);
  }

  const categories = useMemo(() => Array.from(new Set(BLOCKS.map((b) => b.category))), []);

  return (
    <div>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--steel)", margin: "0 0 6px" }}>{cat}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BLOCKS.filter((b) => b.category === cat).map((b) => (
              <label key={b.key} className="card card-interactive" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", cursor: "pointer", border: selected.has(b.key) ? "1.5px solid var(--navy)" : "1.5px solid var(--fog-dark)" }}>
                <input type="checkbox" checked={selected.has(b.key)} onChange={() => toggle(b.key)} />
                <span style={{ fontSize: "0.85rem" }}>{b.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "14px 0" }}>
        {selected.has("studentsByRoute") && (
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: 4 }}>المسار (لتقرير طلاب المسار)</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="input" style={{ minWidth: 260 }}>
              {routes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}
        {selected.has("busDailyRoster") && (
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: 4 }}>الحافلة (لكشف الحافلة اليومي)</label>
            <select value={busId} onChange={(e) => setBusId(e.target.value)} className="input" style={{ minWidth: 200 }}>
              {buses.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        )}
        <button onClick={generate} disabled={selected.size === 0 || loading} className="btn btn-primary">
          {loading ? "جارٍ التحميل..." : "توليد التقرير"}
        </button>
        {blocks.length > 0 && (
          <>
            <button onClick={exportExcel} className="btn btn-secondary"><FileSpreadsheet size={15} /> تصدير Excel</button>
            <button onClick={exportPdf} className="btn btn-secondary"><Printer size={15} /> طباعة / PDF</button>
          </>
        )}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.86rem", marginBottom: 12 }}>{error}</p>}

      {selected.has("paymentsBreakdown") && pendingPayments.length > 0 && (
        <div className="card" style={{ padding: "1rem 1.2rem", marginBottom: 16, background: "#FFF6E5" }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.92rem" }}>إجراء سريع: تأكيد استلام دفعات من السائقين ({pendingPayments.length})</p>
          {pendingPayments.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize: "0.86rem" }}>{p.student} — من {p.driver} — {p.amount}</span>
              <button onClick={() => confirmPayment(p.id)} disabled={confirmBusy === p.id} className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                <CheckCircle2 size={14} /> {confirmBusy === p.id ? "..." : "تأكيد التسليم"}
              </button>
            </div>
          ))}
        </div>
      )}

      {blocks.length > 0 && (
        <div className="report-print-area">
          {blocks.map((b, bi) => (
            <div key={b.key} style={{ breakBefore: bi > 0 ? "page" : undefined, marginBottom: 24 }}>
              {b.pieces.map((p, pi) => (
                <div key={pi} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1.02rem", color: "var(--navy)", margin: "0 0 10px" }}>{p.heading} {p.rows.length > 0 && `(${p.rows.length})`}</h3>
                  {p.columns.length === 0 ? (
                    <p style={{ color: "var(--steel)" }}>اختر معياراً صالحاً أعلاه.</p>
                  ) : (
                    <PieceTable piece={p} pieceId={`${bi}-${pi}`} onRows={(id, rows) => { filteredRows.current[id] = rows; }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
