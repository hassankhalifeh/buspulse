// Definitions for the combined, multi-sheet Excel import ("استيراد شامل"): one workbook covering every core
// fleet-setup table in the order their foreign keys require (a route needs its bus to exist first, a student
// needs their guardian/contract/bus, etc). Pure data + the template builder — no React, no Supabase client —
// so BulkImportPanel.tsx can drive both the template download and the actual row-by-row import from it.

import ExcelJS from "exceljs";

export type SelectOption = { value: string; label: string };

export type SheetKey =
  | "buses" | "drivers" | "clients" | "guardians" | "routes" | "routeStops"
  | "contracts" | "students" | "studentRouteStops" | "payments" | "announcements";

export interface BulkFieldDef {
  key: string;
  label: string;
  required?: boolean;
  type: "text" | "number" | "date" | "select" | "textarea";
  options?: SelectOption[]; // fixed set of valid values (status/type/...)
  ref?: SheetKey;           // this column's typed text is looked up against another sheet's own rows (by name)
  refHint?: string;         // instructions-sheet note + header-cell comment for a ref column
}

export interface BulkSheetDef {
  key: SheetKey;
  name: string; // Excel sheet name, shown to the user
  table: string;
  idField: string;     // server-generated primary key — never read from the file
  noFleetId?: boolean;  // this table has no fleet_id column (student_route_stops)
  // the field whose column other sheets' dropdown lists should pull from (only set where that column
  // is a single literal value the user types — contracts' reference text is computed from two columns
  // plus a server-filled one, so it has none and gets no cross-sheet dropdown)
  displayFieldKey?: string;
  fields: BulkFieldDef[];
  // the text later sheets should use to reference a row of this sheet, computed from the inserted row
  display: (row: Record<string, any>) => string;
}

export const BULK_SHEETS: BulkSheetDef[] = [
  {
    key: "buses", name: "الحافلات", table: "buses", idField: "bus_id", displayFieldKey: "plate_number",
    fields: [
      { key: "plate_number", label: "رقم اللوحة", type: "text", required: true },
      { key: "model", label: "الموديل", type: "text" },
      { key: "manufacture_year", label: "سنة الصنع", type: "number" },
      { key: "capacity", label: "عدد المقاعد", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشطة" }, { value: "In_Maintenance", label: "تحت الصيانة" }, { value: "Retired", label: "خارج الخدمة" }] },
    ],
    display: (r) => r.plate_number ?? "",
  },
  {
    key: "drivers", name: "السائقون", table: "drivers", idField: "driver_id",
    fields: [
      { key: "full_name", label: "الاسم الكامل", type: "text", required: true },
      { key: "phone", label: "الهاتف", type: "text" },
      { key: "license_number", label: "رقم رخصة القيادة", type: "text" },
      { key: "license_expiry", label: "تاريخ انتهاء الرخصة", type: "date" },
      { key: "salary_type", label: "نوع الأجر", type: "select", options: [{ value: "Fixed", label: "ثابت شهرياً" }, { value: "Variable", label: "متغيّر" }] },
      { key: "fixed_monthly_salary", label: "الراتب الشهري الثابت", type: "number" },
      { key: "hire_date", label: "تاريخ التوظيف", type: "date" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    display: (r) => r.full_name ?? "",
  },
  {
    key: "clients", name: "العملاء", table: "clients", idField: "client_id", displayFieldKey: "name",
    fields: [
      { key: "name", label: "اسم العميل (مدرسة/شركة/فرد)", type: "text", required: true },
      { key: "client_type", label: "نوع العميل", type: "select", required: true, options: [{ value: "School", label: "مدرسة" }, { value: "Company", label: "شركة" }, { value: "Individual", label: "فرد" }] },
      { key: "contact_phone", label: "هاتف التواصل", type: "text" },
      { key: "contact_email", label: "بريد إلكتروني", type: "text" },
      { key: "address", label: "العنوان", type: "text" },
      { key: "notes", label: "ملاحظات", type: "textarea" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    display: (r) => r.name ?? "",
  },
  {
    key: "guardians", name: "أولياء الأمور", table: "guardians", idField: "guardian_id", displayFieldKey: "full_name",
    fields: [
      { key: "full_name", label: "الاسم الكامل", type: "text", required: true },
      { key: "phone", label: "الهاتف", type: "text" },
      { key: "email", label: "البريد الإلكتروني", type: "text" },
      { key: "address", label: "العنوان", type: "text" },
    ],
    display: (r) => r.full_name ?? "",
  },
  {
    key: "routes", name: "المسارات", table: "routes", idField: "route_id", displayFieldKey: "route_name",
    fields: [
      { key: "route_name", label: "اسم المسار", type: "text", required: true },
      { key: "bus_id", label: "الحافلة", type: "select", required: true, ref: "buses", refHint: "اكتب رقم اللوحة بالضبط كما في ورقة الحافلات" },
      { key: "shift_type", label: "الدوام", type: "select", required: true, options: [{ value: "Morning", label: "صباحي" }, { value: "Evening", label: "مسائي" }] },
      { key: "scheduled_time", label: "الوقت المجدول", type: "text" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    display: (r) => r.route_name ?? "",
  },
  {
    key: "routeStops", name: "نقاط التوقف", table: "route_stops", idField: "stop_id", displayFieldKey: "stop_name",
    fields: [
      { key: "stop_name", label: "اسم النقطة", type: "text", required: true },
      { key: "route_id", label: "المسار", type: "select", required: true, ref: "routes", refHint: "اكتب اسم المسار بالضبط كما في ورقة المسارات" },
      { key: "stop_order", label: "الترتيب", type: "number" },
    ],
    display: (r) => r.stop_name ?? "",
  },
  {
    key: "contracts", name: "العقود", table: "contracts", idField: "contract_id",
    fields: [
      { key: "client_id", label: "العميل", type: "select", required: true, ref: "clients", refHint: "اكتب اسم العميل بالضبط كما في ورقة العملاء" },
      { key: "contract_type", label: "نوع العقد", type: "select", required: true, options: [{ value: "Trip_Based", label: "مساري (رحلات)" }, { value: "Non_Trip_Lease", label: "تأجير حر" }] },
      { key: "period_type", label: "نوع الفترة", type: "select", required: true, options: [{ value: "Yearly", label: "سنوي" }, { value: "Monthly", label: "شهري" }, { value: "Daily", label: "يومي" }, { value: "OneOff", label: "متفرّق" }] },
      { key: "period_label", label: "وصف الفترة (مثلاً: 2026/2027)", type: "text", required: true },
      { key: "bus_id", label: "الحافلة المخصصة (اختياري)", type: "select", ref: "buses", refHint: "اكتب رقم اللوحة إن وُجدت حافلة مخصصة لهذا العقد" },
      { key: "start_date", label: "تاريخ البداية", type: "date", required: true },
      { key: "end_date", label: "تاريخ النهاية", type: "date" },
      { key: "payment_cycle", label: "دورة الدفع", type: "select", required: true, options: [{ value: "Monthly_Fixed", label: "شهري ثابت" }, { value: "Full_Upfront", label: "كامل مقدماً" }, { value: "Installments", label: "أقساط" }] },
      { key: "total_contract_value", label: "القيمة الإجمالية", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Completed", label: "منتهٍ" }, { value: "Cancelled", label: "ملغى" }] },
    ],
    // client_name is filled in by the database itself from client_id; combined with the period it is unique enough to reference from the Students/Payments sheets
    display: (r) => `${r.client_name ?? ""} — ${r.period_label ?? ""}`,
  },
  {
    key: "students", name: "الطلاب", table: "students", idField: "student_id", displayFieldKey: "full_name",
    fields: [
      { key: "full_name", label: "اسم الطالب", type: "text", required: true },
      { key: "guardian_id", label: "ولي الأمر", type: "select", required: true, ref: "guardians", refHint: "اكتب الاسم الكامل لولي الأمر بالضبط كما في ورقة أولياء الأمور" },
      { key: "relation", label: "صلة القرابة", type: "select", required: true, options: [{ value: "Father", label: "أب" }, { value: "Mother", label: "أم" }, { value: "Grandfather", label: "جد" }, { value: "Uncle", label: "عم/خال" }, { value: "Other", label: "أخرى" }] },
      { key: "contract_id", label: "العقد", type: "select", required: true, ref: "contracts", refHint: "اكتب القيمة بالضبط كما في عمود \"العميل\" + \"وصف الفترة\" بورقة العقود، مفصولة بـ —" },
      { key: "bus_id", label: "الحافلة", type: "select", required: true, ref: "buses", refHint: "اكتب رقم اللوحة بالضبط كما في ورقة الحافلات" },
      { key: "subscription_type", label: "نوع الاشتراك", type: "select", required: true, options: [{ value: "Per_Day", label: "يومي" }, { value: "Per_Month", label: "شهري" }, { value: "Per_Trip", label: "بالرحلة" }] },
      { key: "rate", label: "قيمة الاشتراك", type: "number", required: true },
      { key: "pickup_location", label: "موقع الالتقاط", type: "text" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    display: (r) => r.full_name ?? "",
  },
  {
    key: "studentRouteStops", name: "ربط الطلاب بالمسارات", table: "student_route_stops", idField: "id", noFleetId: true,
    fields: [
      { key: "student_id", label: "الطالب", type: "select", required: true, ref: "students", refHint: "اكتب اسم الطالب بالضبط كما في ورقة الطلاب" },
      { key: "route_id", label: "المسار", type: "select", required: true, ref: "routes", refHint: "اكتب اسم المسار بالضبط كما في ورقة المسارات" },
      { key: "stop_id", label: "نقطة التوقف", type: "select", required: true, ref: "routeStops", refHint: "اكتب اسم النقطة بالضبط كما في ورقة نقاط التوقف" },
    ],
    display: () => "",
  },
  {
    key: "payments", name: "الدفعات", table: "payments", idField: "payment_id",
    fields: [
      { key: "student_id", label: "الطالب", type: "select", required: true, ref: "students", refHint: "اكتب اسم الطالب بالضبط كما في ورقة الطلاب" },
      { key: "contract_id", label: "العقد", type: "select", required: true, ref: "contracts", refHint: "اكتب القيمة بالضبط كما في عمود \"العميل\" + \"وصف الفترة\" بورقة العقود، مفصولة بـ —" },
      { key: "amount", label: "المبلغ", type: "number", required: true },
      { key: "payment_method", label: "طريقة الدفع", type: "select", required: true, options: [{ value: "Cash", label: "كاش" }, { value: "Digital", label: "رقمي" }] },
      { key: "payment_status", label: "الحالة", type: "select", options: [{ value: "Pending", label: "بانتظار التسليم للإدارة" }, { value: "Confirmed", label: "تم التسليم والتأكيد" }] },
      { key: "payment_date", label: "التاريخ", type: "date" },
    ],
    display: () => "",
  },
  {
    key: "announcements", name: "الإعلانات", table: "announcements", idField: "announcement_id",
    fields: [
      { key: "title", label: "العنوان", type: "text", required: true },
      { key: "content", label: "النص", type: "textarea", required: true },
      { key: "announcement_type", label: "النوع", type: "select", required: true, options: [{ value: "Circular", label: "تعميم عادي" }, { value: "Emergency", label: "طارئ" }] },
      { key: "target_audience", label: "الجمهور المستهدف", type: "select", required: true, options: [{ value: "All", label: "الجميع" }, { value: "Specific_Bus", label: "حافلة محددة" }, { value: "Specific_Contract", label: "عقد محدد" }] },
      { key: "target_id", label: "معرّف الحافلة/العقد المستهدف (إن وُجد)", type: "text" },
    ],
    display: () => "",
  },
];

// الأوراق التي تُستخدم كمرجع من أوراق أخرى (كالحافلات لورقة المسارات) — هذه وحدها يُجلب لها الموجود
// فعلاً في الأسطول عند بناء النموذج، لتظهر في القائمة المنسدلة لا أن تبقى القائمة فارغة حتى تُكتب يدوياً
export const REFERENCED_SHEET_KEYS = new Set<SheetKey>(BULK_SHEETS.flatMap((s) => s.fields.filter((f) => f.ref).map((f) => f.ref!)));

// أقصى عدد سطور بيانات تغطّيها القائمة المنسدلة والتنسيق الشرطي في كل عمود — كافٍ لأي أسطول عملياً،
// وأي سطر بعده يبقى قابلاً للتعبئة يدوياً بلا قائمة منسدلة فقط
const MAX_DATA_ROWS = 500;

function colLetter(n: number): string {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function fieldNote(f: BulkFieldDef): string {
  return f.ref ? (f.refHint ?? `مرجع إلى ورقة "${BULK_SHEETS.find((s) => s.key === f.ref)?.name}"`) :
    f.type === "select" && f.options?.length ? "اكتب إحدى القيم التالية بالضبط: " + f.options.map((o) => o.label).join(" / ") :
    f.type === "date" ? "بصيغة سنة-شهر-يوم، مثلاً 2026-09-01" :
    f.type === "number" ? "رقم فقط" : "";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const FILL_REQUIRED: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } }; // دافئ خفيف: حقل إلزامي
const FILL_REF: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } }; // أزرق خفيف: مرتبط بورقة أخرى
const FILL_EXISTING: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }; // رمادي فاتح: سطر موجود مسبقاً في النظام

// الأسطول الحالي: الصفوف الموجودة مسبقاً في كل ورقة من الأوراق المرجعية (REFERENCED_SHEET_KEYS)، بصيغة
// صفوف الجدول نفسه (bus_id/driver_id/... وقيمها الفعلية) — تُجلب في BulkImportPanel.tsx قبل استدعاء هذه الدالة
export type ExistingRows = Partial<Record<SheetKey, Record<string, any>[]>>;

export async function buildBulkTemplate(existing: ExistingRows = {}) {
  const wb = new ExcelJS.Workbook();

  // ورقة التعليمات أولاً لتكون ما يُفتح أمام صاحب الأسطول أولاً، وتُملأ أثناء إنشاء بقية الأوراق أدناه
  const notesWs = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  notesWs.columns = [{ header: "الورقة", width: 20 }, { header: "العمود", width: 34 }, { header: "مطلوب؟", width: 10 }, { header: "ملاحظات", width: 65 }];
  notesWs.getRow(1).font = { bold: true };
  notesWs.addRow(["", "", "", "الأعمدة الملوّنة بالبرتقالي الفاتح إلزامية، والملوّنة بالأزرق الفاتح مرتبطة بقيمة من ورقة أخرى ولها قائمة منسدلة بالضغط على الخلية — مرّر الفأرة فوق أي عنوان عمود لرؤية شرحه مباشرة."]);
  notesWs.addRow(["", "", "", "الصفوف الرمادية بأعلى بعض الأوراق موجودة مسبقاً في أسطولك — أُدرجت هنا فقط لتظهر في القوائم المنسدلة بالأوراق الأخرى؛ تجاهلها بأمان (لن تُستورد مرة ثانية)، وأضف أي جديد في صف فارغ أسفلها."]);

  // id → النص المرجعي لكل صف موجود مسبقاً، حتى يمكن لسطر لاحق (كمسار يشير إلى حافلة) إظهار اسمها لا معرّفها الداخلي
  const idToDisplay = new Map<SheetKey, Map<string, string>>();
  for (const sheet of BULK_SHEETS) {
    const rows = existing[sheet.key] ?? [];
    idToDisplay.set(sheet.key, new Map(rows.map((r) => [r[sheet.idField], sheet.display(r)])));
  }

  // الأوراق المرجعية (كالحافلات) يجب أن تُنشأ قبل الأوراق التي تشير إليها (كالمسارات) حتى تتوفر خلاياها لقائمة الإشارة المنسدلة
  const colByKey = new Map<SheetKey, Map<string, number>>(); // sheet -> field key -> 1-based column index
  const maxRowBySheet = new Map<SheetKey, number>();

  for (const sheet of BULK_SHEETS) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ rightToLeft: true }] });
    ws.columns = sheet.fields.map((f) => ({ header: `${f.label}${f.required ? " *" : ""}`, key: f.key, width: 28 }));
    ws.getRow(1).font = { bold: true };

    const fieldCols = new Map<string, number>();
    sheet.fields.forEach((f, i) => {
      fieldCols.set(f.key, i + 1);
      const cell = ws.getRow(1).getCell(i + 1);
      if (f.ref) cell.fill = FILL_REF;
      else if (f.required) cell.fill = FILL_REQUIRED;
      const note = fieldNote(f);
      if (note) cell.note = note;
      notesWs.addRow([sheet.name, f.label, f.required ? "نعم" : "لا", note]);
    });
    colByKey.set(sheet.key, fieldCols);

    // تعبئة الموجود مسبقاً من هذا الجدول (للأوراق المرجعية فقط) حتى يظهر في القوائم المنسدلة التي تشير إليه
    const existingRows = REFERENCED_SHEET_KEYS.has(sheet.key) ? (existing[sheet.key] ?? []) : [];
    existingRows.forEach((row, r) => {
      const excelRow = ws.getRow(r + 2);
      sheet.fields.forEach((f, i) => {
        const raw = row[f.key];
        const text =
          f.ref ? (idToDisplay.get(f.ref)?.get(raw) ?? "") :
          f.type === "select" && f.options ? (f.options.find((o) => o.value === raw)?.label ?? raw ?? "") :
          raw ?? "";
        excelRow.getCell(i + 1).value = text;
      });
      excelRow.eachCell({ includeEmpty: true }, (cell) => { cell.fill = FILL_EXISTING; });
    });
    maxRowBySheet.set(sheet.key, Math.max(MAX_DATA_ROWS, existingRows.length + 200));
  }

  // قوائم منسدلة: قيم ثابتة للأعمدة المغلقة (كالحالة)، وقائمة من عمود ورقة أخرى (تشمل الموجود مسبقاً أعلاه) للأعمدة المرتبطة بسجل هناك
  for (const sheet of BULK_SHEETS) {
    const ws = wb.getWorksheet(sheet.name)!;
    const sheetMaxRow = maxRowBySheet.get(sheet.key)!;
    sheet.fields.forEach((f, i) => {
      let formula: string | null = null;
      if (f.ref) {
        const targetSheet = BULK_SHEETS.find((s) => s.key === f.ref);
        const targetCol = targetSheet?.displayFieldKey ? colByKey.get(f.ref)?.get(targetSheet.displayFieldKey) : undefined;
        const targetMaxRow = targetSheet ? maxRowBySheet.get(targetSheet.key) : undefined;
        if (targetSheet && targetCol && targetMaxRow) formula = `'${targetSheet.name}'!$${colLetter(targetCol)}$2:$${colLetter(targetCol)}$${targetMaxRow}`;
      } else if (f.type === "select" && f.options?.length) {
        formula = `"${f.options.map((o) => o.label).join(",")}"`;
      }
      if (!formula) return;
      const validation: ExcelJS.DataValidation = {
        type: "list", allowBlank: true, formulae: [formula],
        showErrorMessage: true, errorStyle: "stop", errorTitle: "قيمة غير موجودة في اللائحة",
        error: "اختر قيمة من القائمة المنسدلة لهذه الخلية (أو من الورقة المرجعية لها).",
      };
      for (let row = 2; row <= sheetMaxRow; row++) ws.getCell(row, i + 1).dataValidation = validation;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "نموذج-استيراد-شامل.xlsx");
}
