"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";
import { FileSpreadsheet, Printer } from "lucide-react";

type ReportKey = "guardians" | "studentsByGuardian" | "studentsByRoute" | "drivers";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "guardians", label: "أولياء الأمور" },
  { key: "studentsByGuardian", label: "الطلاب حسب ولي الأمر" },
  { key: "studentsByRoute", label: "طلاب مسار وحافلة محدَّدة" },
  { key: "drivers", label: "السائقون" },
];

interface Row { [key: string]: string | number | null }
interface RouteOption { value: string; label: string; busId: string | null; busPlate: string | null }

// Every export (Excel and PDF) reads straight from what is on screen: one query builds the
// rows, and both buttons reuse them — nothing is fetched twice or formatted twice.
export default function ReportsPanel() {
  const [reportKey, setReportKey] = useState<ReportKey>("guardians");
  const [columns, setColumns] = useState<{ key: string; label: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeId, setRouteId] = useState("");

  useEffect(() => {
    supabase.from("routes").select("route_id, route_name, bus_id, buses(plate_number)").order("route_name").then(({ data }) => {
      const opts = (data ?? []).map((r: any) => ({
        value: r.route_id,
        label: r.buses?.plate_number ? `${r.route_name} — حافلة ${r.buses.plate_number}` : r.route_name,
        busId: r.bus_id,
        busPlate: r.buses?.plate_number ?? null,
      }));
      setRoutes(opts);
      if (opts.length > 0) setRouteId(opts[0].value);
    });
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setRows([]);

    if (reportKey === "guardians") {
      const { data, error: err } = await supabase.from("guardians").select("full_name, phone, email").order("full_name");
      if (err) { setError(err.message); setLoading(false); return; }
      setColumns([{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "email", label: "البريد الإلكتروني" }]);
      setRows(data ?? []);
      setTitle("لائحة أولياء الأمور");
    }

    if (reportKey === "studentsByGuardian") {
      const { data, error: err } = await supabase
        .from("students")
        .select("full_name, guardians(full_name, phone)")
        .order("guardian_id");
      if (err) { setError(err.message); setLoading(false); return; }
      const mapped = (data ?? [])
        .map((s: any) => ({ guardian_name: s.guardians?.full_name ?? "—", guardian_phone: s.guardians?.phone ?? "—", student_name: s.full_name }))
        .sort((a, b) => a.guardian_name.localeCompare(b.guardian_name, "ar"));
      setColumns([{ key: "guardian_name", label: "ولي الأمر" }, { key: "guardian_phone", label: "هاتف ولي الأمر" }, { key: "student_name", label: "اسم الطالب" }]);
      setRows(mapped);
      setTitle("الطلاب مرتَّبين حسب ولي الأمر");
    }

    if (reportKey === "studentsByRoute") {
      if (!routeId) { setLoading(false); return; }
      const { data, error: err } = await supabase
        .from("student_route_stops")
        .select("students(full_name, guardians(phone)), route_stops(stop_name, stop_order)")
        .eq("route_id", routeId);
      if (err) { setError(err.message); setLoading(false); return; }
      const mapped = (data ?? [])
        .map((r: any) => ({
          student_name: r.students?.full_name ?? "—",
          guardian_phone: r.students?.guardians?.phone ?? "—",
          stop_name: r.route_stops?.stop_name ?? "—",
          stop_order: r.route_stops?.stop_order ?? 0,
        }))
        .sort((a, b) => a.stop_order - b.stop_order);
      setColumns([{ key: "student_name", label: "اسم الطالب" }, { key: "guardian_phone", label: "هاتف ولي الأمر" }, { key: "stop_name", label: "نقطة التوقف" }]);
      setRows(mapped);
      const r = routes.find((r) => r.value === routeId);
      setTitle(r ? `طلاب مسار «${r.label}»` : "طلاب المسار");
    }

    if (reportKey === "drivers") {
      const { data, error: err } = await supabase.from("drivers").select("full_name, phone, license_number, status").order("full_name");
      if (err) { setError(err.message); setLoading(false); return; }
      const STATUS_LABEL: Record<string, string> = { Active: "نشط", Inactive: "غير نشط" };
      const mapped = (data ?? []).map((d: any) => ({ ...d, status: STATUS_LABEL[d.status] ?? d.status }));
      setColumns([{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "license_number", label: "رقم رخصة القيادة" }, { key: "status", label: "الحالة" }]);
      setRows(mapped);
      setTitle("لائحة السائقين");
    }

    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reportKey, routeId]);

  function exportExcel() {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key] ?? ""])))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "التقرير");
    XLSX.writeFile(wb, `${title || "تقرير"}.xlsx`);
  }

  function exportPdf() {
    document.body.classList.add("printing-report");
    window.print();
    // afterprint does not fire reliably in every browser (notably some WebViews); a short
    // fallback timeout guarantees the class is removed even then.
    const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 2000);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setReportKey(r.key)} className={`btn ${reportKey === r.key ? "btn-primary" : "btn-secondary"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {reportKey === "studentsByRoute" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: 6 }}>اختر المسار</label>
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="input" style={{ maxWidth: 360 }}>
            {routes.length === 0 && <option value="">لا توجد مسارات</option>}
            {routes.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        <button onClick={exportExcel} disabled={rows.length === 0} className="btn btn-secondary">
          <FileSpreadsheet size={15} /> تصدير Excel
        </button>
        <button onClick={exportPdf} disabled={rows.length === 0} className="btn btn-secondary">
          <Printer size={15} /> طباعة / PDF
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.86rem", marginBottom: 10 }}>{error}</p>}
      {loading && <p style={{ color: "var(--steel)" }}>جارٍ التحميل...</p>}

      {!loading && (
        // Everything printed (the title included) lives inside this box — see the print rules
        // in globals.css — so what you see here is exactly what "طباعة / PDF" produces.
        <div className="report-print-area">
          <h3 style={{ margin: "0 0 12px", fontSize: "1.05rem", color: "var(--navy)" }}>{title} {rows.length > 0 && `(${rows.length})`}</h3>
          <table className="data-table">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key] ?? "—"}</td>)}</tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={columns.length || 1}>لا توجد بيانات.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
