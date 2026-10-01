"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, Download } from "lucide-react";
import type { FieldConfig } from "./AddEntityModal";
import { normalizeText } from "@/lib/tablekit";

interface RowResult {
  data: Record<string, any>;
  valid: boolean;
  errors: string[];
}

interface Props {
  title: string;
  fields: FieldConfig[];
  onConfirm: (rows: Record<string, any>[]) => Promise<{ successCount: number; failCount: number; errors: string[] }>;
  onClose: () => void;
}

// نموذج فارغ بعناوين عربية مطابقة لحقول هذا القسم بالذات، وورقة ثانية بشرح القيم المسموحة لكل عمود
// (خصوصاً أعمدة الاختيار، حيث يكتب المستخدم النص العربي الذي يراه وتتم ترجمته تلقائياً عند الرفع).
function downloadTemplate(title: string, fields: FieldConfig[]) {
  const visible = fields.filter((f) => !f.disabled);
  const headers = visible.map((f) => `${f.label}${f.required ? " *" : ""}`);
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet["!cols"] = headers.map(() => ({ wch: 24 }));

  const notes: (string | number)[][] = [["العمود", "مطلوب؟", "ملاحظات"]];
  for (const f of visible) {
    const note =
      f.type === "select" && f.options?.length ? "اكتب إحدى القيم التالية بالضبط: " + f.options.map((o) => o.label).join(" / ") :
      f.type === "date" ? "بصيغة سنة-شهر-يوم، مثلاً 2026-09-01" :
      f.type === "number" ? "رقم فقط" : "";
    notes.push([f.label, f.required ? "نعم" : "لا", note]);
  }
  const notesSheet = XLSX.utils.aoa_to_sheet(notes);
  notesSheet["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 55 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "البيانات");
  XLSX.utils.book_append_sheet(wb, notesSheet, "تعليمات");
  XLSX.writeFile(wb, `نموذج-${title}.xlsx`);
}

export default function ImportModal({ title, fields, onConfirm, onClose }: Props) {
  const [parsedRows, setParsedRows] = useState<RowResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failCount: number; errors: string[] } | null>(null);

  function validateRow(row: Record<string, any>): string[] {
    const errors: string[] = [];
    for (const f of fields) {
      if (f.disabled) continue; // معرّفات تلقائية — لا تُطلب من الملف
      if (f.required && (row[f.key] === undefined || row[f.key] === null || row[f.key] === "")) {
        errors.push(`الحقل "${f.label}" مفقود`);
      }
      if (f.type === "select" && row[f.key] && f.options && !f.options.find((o) => o.value === row[f.key])) {
        errors.push(`قيمة "${row[f.key]}" غير صحيحة لحقل "${f.label}"`);
      }
    }
    return errors;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // مطابقة عناوين الأعمدة بحقول هذا القسم: أولاً بعنوان النموذج العربي (يتجاهل "*" والمسافات واختلاف الهمزة/التاء)،
      // ثم بمفتاح الحقل الإنكليزي للتوافق مع ملفات قديمة كُتبت عناوينها يدوياً بالمفتاح نفسه
      function matchField(header: string): FieldConfig | undefined {
        const clean = normalizeText(header.replace(/\*\s*$/, ""));
        return (
          fields.find((f) => !f.disabled && normalizeText(f.label) === clean) ??
          fields.find((f) => !f.disabled && header.toLowerCase().startsWith(f.key.toLowerCase()))
        );
      }

      const mapped = raw.map((row) => {
        const cleanRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          // المعرّفات التلقائية (disabled) تُولَّد في الخادم، فنتجاهل أي قيمة لها في الملف
          const matchedField = matchField(key);
          if (!matchedField) continue;
          let value = String(row[key]).trim();
          // أعمدة الاختيار: يكتب المستخدم النص العربي الظاهر في النموذج، فنحوّله إلى القيمة الفعلية المخزَّنة
          if (matchedField.type === "select" && matchedField.options) {
            const opt = matchedField.options.find((o) => o.value === value || normalizeText(o.label) === normalizeText(value));
            if (opt) value = opt.value;
          }
          cleanRow[matchedField.key] = value;
        }
        return cleanRow;
      });

      const results: RowResult[] = mapped
        .filter((r) => Object.values(r).some((v) => v !== ""))
        .map((data) => {
          const errors = validateRow(data);
          return { data, valid: errors.length === 0, errors };
        });
      setParsedRows(results);
    };
    reader.readAsBinaryString(file);
  }

  async function handleConfirm() {
    if (!parsedRows) return;
    const validRows = parsedRows.filter((r) => r.valid).map((r) => r.data);
    setSubmitting(true);
    const res = await onConfirm(validRows);
    setSubmitting(false);
    setResult(res);
  }

  const validCount = parsedRows?.filter((r) => r.valid).length ?? 0;
  const invalidCount = parsedRows?.filter((r) => !r.valid).length ?? 0;

  return (
    <div onClick={onClose} className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(27,42,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: "1.75rem", width: 640, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--navy)" }}>استيراد {title} من Excel</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {!parsedRows && !result && (
          <>
            <button type="button" onClick={() => downloadTemplate(title, fields)} className="btn btn-secondary" style={{ width: "100%", marginBottom: 14 }}>
              <Download size={16} /> تنزيل نموذج Excel فارغ
            </button>
            <label className="card card-interactive" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "2.5rem", border: "2px dashed var(--fog-dark)", cursor: "pointer" }}>
              <Upload size={28} color="var(--steel)" />
              <span>اضغط لاختيار ملف Excel (ورقة واحدة)</span>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            </label>
          </>
        )}

        {parsedRows && !result && (
          <>
            <p style={{ marginBottom: 12 }}>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>{validCount} صف جاهز</span>
              {invalidCount > 0 && <span style={{ color: "var(--red)", fontWeight: 700, marginRight: 12 }}> — {invalidCount} صف فيه خطأ</span>}
            </p>
            <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 16 }}>
              <table className="data-table">
                <thead><tr>{fields.filter((f) => !f.disabled).map((f) => <th key={f.key}>{f.label}</th>)}<th>الحالة</th></tr></thead>
                <tbody>
                  {parsedRows.map((r, i) => (
                    <tr key={i} style={{ background: r.valid ? "#eaf4ea" : "#fbeaea" }}>
                      {fields.filter((f) => !f.disabled).map((f) => <td key={f.key}>{r.data[f.key] || "—"}</td>)}
                      <td style={{ fontSize: "0.8rem", color: r.valid ? "var(--green)" : "var(--red)" }}>
                        {r.valid ? "جاهز" : r.errors.join("، ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleConfirm} disabled={submitting || validCount === 0} className="btn btn-primary" style={{ flex: 1 }}>
                {submitting ? "جارٍ الحفظ..." : `تأكيد استيراد ${validCount} صف`}
              </button>
              <button onClick={() => setParsedRows(null)} className="btn btn-secondary">اختيار ملف آخر</button>
            </div>
          </>
        )}

        {result && (
          <div>
            <p style={{ color: "var(--green)", fontWeight: 700, marginBottom: 8 }}>تم إدخال {result.successCount} صف بنجاح.</p>
            {result.failCount > 0 && (
              <>
                <p style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>فشل {result.failCount} صف:</p>
                <ul style={{ fontSize: "0.85rem", color: "var(--red)" }}>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </>
            )}
            <button onClick={onClose} className="btn btn-primary" style={{ width: "100%", marginTop: 16 }}>إغلاق</button>
          </div>
        )}
      </div>
    </div>
  );
}
