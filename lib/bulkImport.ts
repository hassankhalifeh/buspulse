// Definitions for the combined, multi-sheet Excel import ("استيراد شامل"): one workbook covering every core
// fleet-setup table in the order their foreign keys require (a route needs its bus to exist first, a student
// needs their guardian/contract/bus, etc). Pure data + the template builder — no React, no Supabase client —
// so BulkImportPanel.tsx can drive both the template download and the actual row-by-row import from it.

import * as XLSX from "xlsx";

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
  refHint?: string;         // instructions-sheet note for a ref column
}

export interface BulkSheetDef {
  key: SheetKey;
  name: string; // Excel sheet name, shown to the user
  table: string;
  idField: string;    // server-generated primary key — never read from the file
  noFleetId?: boolean; // this table has no fleet_id column (student_route_stops)
  fields: BulkFieldDef[];
  // the text later sheets should use to reference a row of this sheet, computed from the inserted row
  display: (row: Record<string, any>) => string;
}

export const BULK_SHEETS: BulkSheetDef[] = [
  {
    key: "buses", name: "الحافلات", table: "buses", idField: "bus_id",
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
    key: "clients", name: "العملاء", table: "clients", idField: "client_id",
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
    key: "guardians", name: "أولياء الأمور", table: "guardians", idField: "guardian_id",
    fields: [
      { key: "full_name", label: "الاسم الكامل", type: "text", required: true },
      { key: "phone", label: "الهاتف", type: "text" },
      { key: "email", label: "البريد الإلكتروني", type: "text" },
      { key: "address", label: "العنوان", type: "text" },
    ],
    display: (r) => r.full_name ?? "",
  },
  {
    key: "routes", name: "المسارات", table: "routes", idField: "route_id",
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
    key: "routeStops", name: "نقاط التوقف", table: "route_stops", idField: "stop_id",
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
    key: "students", name: "الطلاب", table: "students", idField: "student_id",
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

export function buildBulkTemplate() {
  const wb = XLSX.utils.book_new();
  const notes: (string | number)[][] = [["الورقة", "العمود", "مطلوب؟", "ملاحظات"]];

  for (const sheet of BULK_SHEETS) {
    const headers = sheet.fields.map((f) => `${f.label}${f.required ? " *" : ""}`);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map(() => ({ wch: 26 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);

    for (const f of sheet.fields) {
      const note =
        f.ref ? (f.refHint ?? `مرجع إلى ورقة "${BULK_SHEETS.find((s) => s.key === f.ref)?.name}"`) :
        f.type === "select" && f.options?.length ? "اكتب إحدى القيم التالية بالضبط: " + f.options.map((o) => o.label).join(" / ") :
        f.type === "date" ? "بصيغة سنة-شهر-يوم، مثلاً 2026-09-01" :
        f.type === "number" ? "رقم فقط" : "";
      notes.push([sheet.name, f.label, f.required ? "نعم" : "لا", note]);
    }
  }

  const notesSheet = XLSX.utils.aoa_to_sheet(notes);
  notesSheet["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, notesSheet, "تعليمات");
  // instructions first, so it's what the owner sees on opening the file
  wb.SheetNames.unshift(wb.SheetNames.pop()!);

  XLSX.writeFile(wb, "نموذج-استيراد-شامل.xlsx");
}
