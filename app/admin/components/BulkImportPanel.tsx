"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeText } from "@/lib/tablekit";
import { BULK_SHEETS, buildBulkTemplate, type BulkSheetDef, type SheetKey } from "@/lib/bulkImport";
import SimpleTable from "./SimpleTable";

type RowResult = { sheet: string; row: number; item: string; status: "ok" | "error"; message: string };
const RESULT_COLUMNS = [
  { key: "sheet", label: "الورقة" }, { key: "row", label: "السطر" }, { key: "item", label: "العنصر" },
  { key: "status_text", label: "النتيجة" }, { key: "message", label: "التفاصيل" },
];
const STATUS_TEXT: Record<RowResult["status"], string> = { ok: "✓ تمّ", error: "✗ خطأ" };

function matchHeader(sheet: BulkSheetDef, header: string) {
  const clean = normalizeText(header.replace(/\*\s*$/, ""));
  return sheet.fields.find((f) => normalizeText(f.label) === clean);
}

// الأوراق التي تُستخدم كمرجع من أوراق أخرى (مثل الحافلات لورقة المسارات): نحتاج خريطة نص→معرّف لها،
// مبدوءة بما هو موجود مسبقاً في قاعدة البيانات لهذا الأسطول حتى تصح الإشارة لسجل لم يأتِ من هذا الملف.
const REFERENCED_SHEETS = new Set<SheetKey>(BULK_SHEETS.flatMap((s) => s.fields.filter((f) => f.ref).map((f) => f.ref!)));

export default function BulkImportPanel({ fleetId }: { fleetId: string }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function processSheet(sheet: BulkSheetDef, rawRows: Record<string, any>[], idByDisplay: Map<SheetKey, Map<string, string>>, out: RowResult[]) {
    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // header is row 1
      if (!Object.values(raw).some((v) => String(v).trim() !== "")) continue;

      const data: Record<string, any> = {};
      for (const key of Object.keys(raw)) {
        const f = matchHeader(sheet, key);
        if (f) data[f.key] = String(raw[key] ?? "").trim();
      }

      const errors: string[] = [];
      for (const f of sheet.fields) {
        const value = data[f.key] ?? "";
        if (value === "") { if (f.required) errors.push(`الحقل "${f.label}" مفقود`); continue; }
        if (f.ref) {
          const id = idByDisplay.get(f.ref)!.get(normalizeText(value));
          if (!id) { errors.push(`"${value}" غير موجود في ورقة "${BULK_SHEETS.find((s) => s.key === f.ref)!.name}"`); continue; }
          data[f.key] = id;
        } else if (f.type === "select" && f.options) {
          const opt = f.options.find((o) => o.value === value || normalizeText(o.label) === normalizeText(value));
          if (!opt) { errors.push(`قيمة "${value}" غير صحيحة لحقل "${f.label}"`); continue; }
          data[f.key] = opt.value;
        } else if (f.type === "number") {
          const n = Number(value);
          if (Number.isNaN(n)) { errors.push(`"${value}" ليست رقماً صالحاً لحقل "${f.label}"`); continue; }
          data[f.key] = n;
        }
      }

      const item = String(data.full_name ?? data.plate_number ?? data.name ?? data.route_name ?? data.stop_name ?? data.title ?? `سطر ${rowNum}`);
      if (errors.length) { out.push({ sheet: sheet.name, row: rowNum, item, status: "error", message: errors.join("، ") }); continue; }

      const payload = sheet.noFleetId ? data : { ...data, fleet_id: fleetId };
      const { data: inserted, error: err } = await supabase.from(sheet.table).insert(payload).select("*").single();
      if (err || !inserted) { out.push({ sheet: sheet.name, row: rowNum, item, status: "error", message: err?.message ?? "تعذّرت الإضافة" }); continue; }

      out.push({ sheet: sheet.name, row: rowNum, item, status: "ok", message: "أُضيف" });
      const disp = sheet.display(inserted);
      if (disp) idByDisplay.get(sheet.key)!.set(normalizeText(disp), inserted[sheet.idField]);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResults([]);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const idByDisplay = new Map<SheetKey, Map<string, string>>();
      for (const sheet of BULK_SHEETS) idByDisplay.set(sheet.key, new Map());
      for (const sheet of BULK_SHEETS) {
        if (!REFERENCED_SHEETS.has(sheet.key)) continue;
        const { data } = await supabase.from(sheet.table).select("*").eq("fleet_id", fleetId);
        for (const row of data ?? []) {
          const disp = sheet.display(row);
          if (disp) idByDisplay.get(sheet.key)!.set(normalizeText(disp), row[sheet.idField]);
        }
      }

      const out: RowResult[] = [];
      for (const sheet of BULK_SHEETS) {
        const ws = wb.Sheets[sheet.name];
        if (!ws) continue; // لم يُمسّ هذا الجدول في الملف — يُتخطّى بصمت
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        await processSheet(sheet, rawRows, idByDisplay, out);
      }
      setResults(out);
    } catch (ex: any) {
      setError("تعذّرت قراءة الملف: " + ex.message);
    } finally {
      setBusy(false);
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="fade-in">
      <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginBottom: 14, maxWidth: 680 }}>
        ملف واحد بعدة أوراق — حافلات، سائقون، عملاء، أولياء أمور، مسارات، نقاط توقف، عقود، طلاب، ربط الطلاب بالمسارات، دفعات، إعلانات —
        يُستورد دفعة واحدة. يمكنك تعبئة أي عدد من الأوراق وترك الباقي فارغاً (مثلاً طلاب بلا أي سائقين جدد — الطلاب لا يحتاجون سائقاً
        أصلاً). الترتيب بين الأوراق مهم (مثلاً: المسار يحتاج حافلة موجودة مسبقاً)، لذا رتّب تعبئتك وفق ترتيب الأوراق في النموذج. الأعمدة
        البرتقالية إلزامية، والأعمدة الزرقاء مرتبطة بسجل من ورقة أخرى ولها قائمة منسدلة بالضغط على الخلية — اختر منها مباشرة بدل الكتابة
        يدوياً لتفادي أي خطأ إملائي، ومرّر الفأرة فوق أي عنوان عمود لرؤية شرحه. راجع ورقة "تعليمات" في النموذج لكل التفاصيل.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" onClick={() => buildBulkTemplate().catch((ex: any) => setError("تعذّر إنشاء النموذج: " + ex.message))} className="btn btn-secondary">
          <Download size={16} /> تنزيل نموذج Excel شامل
        </button>
        <label className="btn btn-primary" style={{ cursor: "pointer" }}>
          <Upload size={16} /> {busy ? "جارٍ الاستيراد..." : "رفع الملف المعبَّأ"}
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
        </label>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.88rem", marginBottom: 14 }}>{error}</p>}

      {results.length > 0 && (
        <>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>{okCount} صف أُضيف</span>
            {errorCount > 0 && <span style={{ color: "var(--red)", fontWeight: 700, marginRight: 12 }}> — {errorCount} صف فيه خطأ</span>}
          </p>
          <SimpleTable columns={RESULT_COLUMNS} rows={results.map((r) => ({ ...r, status_text: STATUS_TEXT[r.status] }))} />
        </>
      )}
    </div>
  );
}
