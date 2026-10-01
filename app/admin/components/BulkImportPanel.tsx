"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeText } from "@/lib/tablekit";
import { BULK_SHEETS, REFERENCED_SHEET_KEYS, buildBulkTemplate, type BulkSheetDef, type SheetKey, type ExistingRows } from "@/lib/bulkImport";
import SimpleTable from "./SimpleTable";

type RowResult = { sheet: string; row: number; item: string; status: "ok" | "skipped" | "error"; message: string };
const RESULT_COLUMNS = [
  { key: "sheet", label: "الورقة" }, { key: "row", label: "السطر" }, { key: "item", label: "العنصر" },
  { key: "status_text", label: "النتيجة" }, { key: "message", label: "التفاصيل" },
];
const STATUS_TEXT: Record<RowResult["status"], string> = { ok: "✓ تمّ", skipped: "تخطٍّ", error: "✗ خطأ" };

function matchHeader(sheet: BulkSheetDef, header: string) {
  const clean = normalizeText(header.replace(/\*\s*$/, ""));
  return sheet.fields.find((f) => normalizeText(f.label) === clean);
}

// ما هو موجود فعلاً في هذا الأسطول من كل ورقة مرجعية (كالحافلات) — تُستخدم لتعبئة القوائم المنسدلة عند
// تنزيل النموذج، ولإسناد الصفوف المرجعية الموجودة مسبقاً عند الرفع (ليصح ذكرها حتى لو لم تُكتب في الملف نفسه)
async function fetchExistingRows(fleetId: string): Promise<ExistingRows> {
  const out: ExistingRows = {};
  for (const sheet of BULK_SHEETS) {
    if (!REFERENCED_SHEET_KEYS.has(sheet.key)) continue;
    const { data } = await supabase.from(sheet.table).select("*").eq("fleet_id", fleetId);
    out[sheet.key] = data ?? [];
  }
  return out;
}

export default function BulkImportPanel({ fleetId }: { fleetId: string }) {
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function downloadTemplate() {
    setError(null);
    setTemplateBusy(true);
    try {
      await buildBulkTemplate(await fetchExistingRows(fleetId));
    } catch (ex: any) {
      setError("تعذّر إنشاء النموذج: " + ex.message);
    } finally {
      setTemplateBusy(false);
    }
  }

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

      // صف موجود مسبقاً (من الصفوف الرمادية التي يملأها النموذج تلقائياً، أو أعيد رفعه كما هو): يُتخطّى بلا تكرار،
      // والمعرّف الموجود أصلاً في الخريطة يبقى صالحاً للإشارة إليه من صفوف لاحقة
      const prospectiveDisplay = sheet.display(data);
      if (prospectiveDisplay && idByDisplay.get(sheet.key)!.has(normalizeText(prospectiveDisplay))) {
        out.push({ sheet: sheet.name, row: rowNum, item, status: "skipped", message: "موجود مسبقاً في الأسطول" });
        continue;
      }

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

      const existing = await fetchExistingRows(fleetId);
      const idByDisplay = new Map<SheetKey, Map<string, string>>();
      for (const sheet of BULK_SHEETS) {
        const map = new Map<string, string>();
        for (const row of existing[sheet.key] ?? []) {
          const disp = sheet.display(row);
          if (disp) map.set(normalizeText(disp), row[sheet.idField]);
        }
        idByDisplay.set(sheet.key, map);
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
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="fade-in">
      <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginBottom: 14, maxWidth: 680 }}>
        ملف واحد بعدة أوراق — حافلات، سائقون، عملاء، أولياء أمور، مسارات، نقاط توقف، عقود، طلاب، ربط الطلاب بالمسارات، دفعات، إعلانات —
        يُستورد دفعة واحدة. يمكنك تعبئة أي عدد من الأوراق وترك الباقي فارغاً (مثلاً طلاب بلا أي سائقين جدد — الطلاب لا يحتاجون سائقاً
        أصلاً). الترتيب بين الأوراق مهم (مثلاً: المسار يحتاج حافلة موجودة مسبقاً)، لذا رتّب تعبئتك وفق ترتيب الأوراق في النموذج. الأعمدة
        البرتقالية إلزامية، والأعمدة الزرقاء مرتبطة بسجل من ورقة أخرى ولها قائمة منسدلة بالضغط على الخلية تضم الموجود فعلاً في أسطولك —
        اختر منها مباشرة بدل الكتابة يدوياً لتفادي أي خطأ إملائي، ومرّر الفأرة فوق أي عنوان عمود لرؤية شرحه. راجع ورقة "تعليمات" في
        النموذج لكل التفاصيل. الصفوف الموجودة مسبقاً تُدرَج تلقائياً (رمادية اللون) ليسهل اختيارها، ولا خطر من رفعها كما هي — يُتخطّى أي
        صف يطابق سجلاً موجوداً بدل تكراره.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" onClick={downloadTemplate} disabled={templateBusy} className="btn btn-secondary">
          <Download size={16} /> {templateBusy ? "جارٍ التحضير..." : "تنزيل نموذج Excel شامل"}
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
            {skippedCount > 0 && <span style={{ color: "var(--steel)", fontWeight: 700, marginRight: 12 }}> — {skippedCount} موجود مسبقاً (تُخطّي)</span>}
            {errorCount > 0 && <span style={{ color: "var(--red)", fontWeight: 700, marginRight: 12 }}> — {errorCount} صف فيه خطأ</span>}
          </p>
          <SimpleTable columns={RESULT_COLUMNS} rows={results.map((r) => ({ ...r, status_text: STATUS_TEXT[r.status] }))} />
        </>
      )}
    </div>
  );
}
