"use client";

import { useEffect, useState } from "react";
import { useAppUser } from "@/lib/useAppUser";
import { useCurrentFleetId } from "@/lib/useCurrentFleetId";
import { useCurrentWaTenantId } from "@/lib/useCurrentWaTenantId";
import { generateNextId } from "@/lib/generateNextId";
import { supabase } from "@/lib/supabaseClient";
import {
  BusFront, Users, FileText, UserRound, GraduationCap,
  Wallet, TrendingUp, Megaphone, Plus, MessageCircle, MapPinned,
  Receipt, Radio, History, CalendarOff, ShieldCheck, PhoneCall, BookOpen, ToggleLeft,
} from "lucide-react";
import KpiCards from "./components/KpiCards";
import SosFeed from "./components/SosFeed";
import SimpleTable, { Column } from "./components/SimpleTable";
import AddEntityModal, { FieldConfig } from "./components/AddEntityModal";
import WaPaymentsPanel from "./components/WaPaymentsPanel";
import WaExpensesPanel from "./components/WaExpensesPanel";
import PermissionsMatrix from "./components/PermissionsMatrix";
import RingSchedulePanel from "./components/RingSchedulePanel";

type Section =
  | "buses" | "drivers" | "contracts" | "guardians" | "students" | "payments" | "pl" | "announcements"
  | "waContacts" | "waRoutes" | "waStudents" | "waPayments" | "waExpenses" | "waBroadcasts" | "waMessages" | "waHolidays"
  | "waRingSchedule" | "waExamSchedules" | "waOverrides" | "permissions";

const CORE_SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "buses", label: "الحافلات", icon: BusFront },
  { id: "drivers", label: "السائقين", icon: Users },
  { id: "contracts", label: "العقود", icon: FileText },
  { id: "guardians", label: "أولياء الأمور", icon: UserRound },
  { id: "students", label: "الطلاب", icon: GraduationCap },
  { id: "payments", label: "الدفعات", icon: Wallet },
  { id: "pl", label: "الأرباح والخسائر", icon: TrendingUp },
  { id: "announcements", label: "الإعلانات", icon: Megaphone },
  { id: "permissions", label: "الصلاحيات", icon: ShieldCheck },
];

// Only shown once this fleet has actually activated the WhatsApp
// module (a wa_tenants row linked to it exists) — see useCurrentWaTenantId.
const WA_SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "waContacts", label: "جهات اتصال الواتساب", icon: MessageCircle },
  { id: "waRoutes", label: "المسارات", icon: MapPinned },
  { id: "waStudents", label: "طلاب البوت", icon: GraduationCap },
  { id: "waPayments", label: "دفعات البوت", icon: Wallet },
  { id: "waExpenses", label: "مصاريف السائقين", icon: Receipt },
  { id: "waRingSchedule", label: "جدولة التذكير الهاتفي", icon: PhoneCall },
  { id: "waExamSchedules", label: "أيام الامتحانات", icon: BookOpen },
  { id: "waOverrides", label: "استثناءات يومية", icon: ToggleLeft },
  { id: "waBroadcasts", label: "سجل البث", icon: Radio },
  { id: "waMessages", label: "سجل الرسائل", icon: History },
  { id: "waHolidays", label: "العطل", icon: CalendarOff },
];

const SECTION_QUERY: Partial<Record<Section, { table: string; columns: Column[]; orderBy?: string }>> = {
  buses: { table: "buses", columns: [{ key: "plate_number", label: "اللوحة" }, { key: "model", label: "الموديل" }, { key: "status", label: "الحالة" }] },
  drivers: { table: "drivers", columns: [{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "salary_type", label: "نوع الأجر" }, { key: "status", label: "الحالة" }] },
  contracts: { table: "contracts", columns: [{ key: "client_name", label: "العميل" }, { key: "contract_type", label: "نوع العقد" }, { key: "payment_cycle", label: "دورة الدفع" }, { key: "status", label: "الحالة" }] },
  guardians: { table: "guardians", columns: [{ key: "full_name", label: "الاسم" }, { key: "phone", label: "الهاتف" }, { key: "email", label: "البريد الإلكتروني" }] },
  students: { table: "students", columns: [{ key: "full_name", label: "اسم الطالب" }, { key: "subscription_type", label: "نوع الاشتراك" }, { key: "bus_id", label: "الحافلة" }, { key: "status", label: "الحالة" }] },
  payments: { table: "payments", columns: [{ key: "student_id", label: "الطالب" }, { key: "amount", label: "المبلغ" }, { key: "payment_method", label: "طريقة الدفع" }, { key: "payment_status", label: "الحالة" }, { key: "payment_date", label: "التاريخ" }], orderBy: "payment_date" },
  announcements: { table: "announcements", columns: [{ key: "title", label: "العنوان" }, { key: "announcement_type", label: "النوع" }, { key: "target_audience", label: "الجمهور المستهدف" }, { key: "created_at", label: "تاريخ النشر" }], orderBy: "created_at" },
  pl: { table: "v_bus_monthly_pl", columns: [] },
  waContacts: { table: "wa_contacts", columns: [{ key: "full_name", label: "الاسم" }, { key: "phone_number", label: "الهاتف" }, { key: "role", label: "الدور" }, { key: "whitelisted", label: "مفعّل" }] },
  waRoutes: { table: "wa_routes", columns: [{ key: "route_name", label: "اسم المسار" }, { key: "school_name", label: "المدرسة" }, { key: "default_bus_ref", label: "الحافلة الافتراضية" }] },
  waStudents: { table: "wa_students", columns: [{ key: "student_name", label: "اسم الطالب" }, { key: "class_level", label: "الصف" }, { key: "station", label: "المحطة" }, { key: "outstanding_debt", label: "الرصيد المستحق" }] },
  waBroadcasts: { table: "wa_broadcasts", columns: [{ key: "broadcast_type", label: "النوع" }, { key: "message_text", label: "النص" }, { key: "recipient_count", label: "عدد المستلمين" }, { key: "sent_at", label: "الوقت" }], orderBy: "sent_at" },
  waMessages: { table: "wa_message_log", columns: [{ key: "phone_number", label: "الرقم" }, { key: "direction", label: "الاتجاه" }, { key: "message_type", label: "النوع" }, { key: "created_at", label: "الوقت" }], orderBy: "created_at" },
  waHolidays: { table: "wa_holidays", columns: [{ key: "holiday_date", label: "التاريخ" }, { key: "description", label: "الوصف" }] },
  waExamSchedules: { table: "wa_class_exam_schedules", columns: [{ key: "class_level", label: "الصف" }, { key: "exam_date", label: "التاريخ" }, { key: "description", label: "الوصف" }] },
  waOverrides: { table: "wa_daily_reminder_overrides", columns: [{ key: "scope_type", label: "النطاق" }, { key: "override_date", label: "التاريخ" }, { key: "is_enabled", label: "مفعّل" }], orderBy: "override_date" },
};

export default function AdminPage() {
  const { appUser, loading } = useAppUser();
  const fleetId = useCurrentFleetId(appUser);
  const waTenantId = useCurrentWaTenantId(fleetId);

  const [section, setSection] = useState<Section>("buses");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [plRows, setPlRows] = useState<Record<string, any>[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [refBuses, setRefBuses] = useState<{ value: string; label: string }[]>([]);
  const [refDrivers, setRefDrivers] = useState<{ value: string; label: string }[]>([]);
  const [refContracts, setRefContracts] = useState<{ value: string; label: string }[]>([]);
  const [refGuardians, setRefGuardians] = useState<{ value: string; label: string }[]>([]);
  const [refStudents, setRefStudents] = useState<{ value: string; label: string }[]>([]);
  const [refWaParents, setRefWaParents] = useState<{ value: string; label: string }[]>([]);
  const [refWaDrivers, setRefWaDrivers] = useState<{ value: string; label: string }[]>([]);
  const [refWaRoutes, setRefWaRoutes] = useState<{ value: string; label: string }[]>([]);
  const [refWaStudents, setRefWaStudents] = useState<{ value: string; label: string }[]>([]);

  function loadSectionRows() {
    if (section === "pl") {
      supabase.from("v_bus_monthly_pl").select("*").order("month", { ascending: false }).limit(20)
        .then(({ data }) => setPlRows(data ?? []));
      return;
    }
    const cfg = SECTION_QUERY[section];
    if (!cfg) return;

    const isWa = section.startsWith("wa");
    let query = supabase.from(cfg.table).select("*");
    if (isWa && waTenantId) query = query.eq("wa_tenant_id", waTenantId);
    if (cfg.orderBy) query = query.order(cfg.orderBy, { ascending: false });
    query.then(({ data }) => setRows(data ?? []));
  }

  useEffect(() => {
    if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin")) return;
    if (section.startsWith("wa") && section !== "waPayments" && section !== "waExpenses" && !waTenantId) return;
    loadSectionRows();
  }, [appUser, section, waTenantId]);

  useEffect(() => {
    if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin")) return;
    supabase.from("buses").select("bus_id, plate_number").then(({ data }) => setRefBuses((data ?? []).map((b) => ({ value: b.bus_id, label: b.plate_number }))));
    supabase.from("drivers").select("driver_id, full_name").then(({ data }) => setRefDrivers((data ?? []).map((d) => ({ value: d.driver_id, label: d.full_name }))));
    supabase.from("contracts").select("contract_id, client_name").then(({ data }) => setRefContracts((data ?? []).map((c) => ({ value: c.contract_id, label: c.client_name }))));
    supabase.from("guardians").select("guardian_id, full_name").then(({ data }) => setRefGuardians((data ?? []).map((g) => ({ value: g.guardian_id, label: g.full_name }))));
    supabase.from("students").select("student_id, full_name").then(({ data }) => setRefStudents((data ?? []).map((s) => ({ value: s.student_id, label: s.full_name }))));
  }, [appUser, rows]);

  useEffect(() => {
    if (!waTenantId) return;
    supabase.from("wa_contacts").select("id, full_name, phone_number").eq("wa_tenant_id", waTenantId).eq("role", "parent")
      .then(({ data }) => setRefWaParents((data ?? []).map((p) => ({ value: p.id, label: p.full_name ?? p.phone_number }))));
    supabase.from("wa_contacts").select("id, full_name, phone_number").eq("wa_tenant_id", waTenantId).eq("role", "driver")
      .then(({ data }) => setRefWaDrivers((data ?? []).map((d) => ({ value: d.id, label: d.full_name ?? d.phone_number }))));
    supabase.from("wa_routes").select("id, route_name").eq("wa_tenant_id", waTenantId)
      .then(({ data }) => setRefWaRoutes((data ?? []).map((r) => ({ value: r.id, label: r.route_name }))));
    supabase.from("wa_students").select("id, student_name").eq("wa_tenant_id", waTenantId)
      .then(({ data }) => setRefWaStudents((data ?? []).map((s) => ({ value: s.id, label: s.student_name }))));
  }, [waTenantId, rows]);

  if (loading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin")) {
    return <p style={{ padding: 24, color: "var(--steel)" }}>هذه الصفحة مخصصة للإدارة فقط.</p>;
  }

  const existingIds = rows.map((r) => Object.values(r)[0] as string);

  const FIELD_CONFIGS: Partial<Record<Section, FieldConfig[]>> = {
    buses: [
      { key: "bus_id", label: "معرّف الحافلة", type: "text", required: true },
      { key: "plate_number", label: "رقم اللوحة", type: "text", required: true },
      { key: "model", label: "الموديل", type: "text" },
      { key: "manufacture_year", label: "سنة الصنع", type: "number" },
      { key: "capacity", label: "عدد المقاعد", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشطة" }, { value: "In_Maintenance", label: "تحت الصيانة" }, { value: "Retired", label: "خارج الخدمة" }] },
    ],
    drivers: [
      { key: "driver_id", label: "معرّف السائق", type: "text", required: true },
      { key: "full_name", label: "الاسم الكامل", type: "text", required: true },
      { key: "phone", label: "الهاتف", type: "text" },
      { key: "license_number", label: "رقم رخصة القيادة", type: "text" },
      { key: "license_expiry", label: "تاريخ انتهاء الرخصة", type: "date" },
      { key: "salary_type", label: "نوع الأجر", type: "select", options: [{ value: "Fixed", label: "ثابت شهرياً" }, { value: "Variable", label: "متغيّر" }] },
      { key: "fixed_monthly_salary", label: "الراتب الشهري الثابت", type: "number" },
      { key: "hire_date", label: "تاريخ التوظيف", type: "date" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    contracts: [
      { key: "contract_id", label: "معرّف العقد", type: "text", required: true },
      { key: "contract_type", label: "نوع العقد", type: "select", required: true, options: [{ value: "Trip_Based", label: "مساري (رحلات)" }, { value: "Non_Trip_Lease", label: "تأجير حر" }] },
      { key: "client_name", label: "اسم العميل", type: "text", required: true },
      { key: "client_type", label: "نوع العميل", type: "select", required: true, options: [{ value: "School", label: "مدرسة" }, { value: "Company", label: "شركة" }, { value: "Individual", label: "فرد" }] },
      { key: "bus_id", label: "الحافلة المخصصة (إن وُجدت)", type: "select", options: refBuses },
      { key: "start_date", label: "تاريخ البداية", type: "date", required: true },
      { key: "end_date", label: "تاريخ النهاية", type: "date" },
      { key: "payment_cycle", label: "دورة الدفع", type: "select", required: true, options: [{ value: "Monthly_Fixed", label: "شهري ثابت" }, { value: "Full_Upfront", label: "كامل مقدماً" }, { value: "Installments", label: "أقساط" }] },
      { key: "total_contract_value", label: "القيمة الإجمالية", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Completed", label: "منتهٍ" }, { value: "Cancelled", label: "ملغى" }] },
    ],
    guardians: [
      { key: "guardian_id", label: "معرّف ولي الأمر", type: "text", required: true },
      { key: "full_name", label: "الاسم الكامل", type: "text", required: true },
      { key: "phone", label: "الهاتف", type: "text" },
      { key: "email", label: "البريد الإلكتروني", type: "text" },
    ],
    students: [
      { key: "student_id", label: "معرّف الطالب", type: "text", required: true },
      { key: "full_name", label: "اسم الطالب", type: "text", required: true },
      { key: "guardian_id", label: "ولي الأمر", type: "select", required: true, options: refGuardians },
      { key: "relation", label: "صلة القرابة", type: "select", required: true, options: [{ value: "Father", label: "أب" }, { value: "Mother", label: "أم" }, { value: "Grandfather", label: "جد" }, { value: "Uncle", label: "عم/خال" }, { value: "Other", label: "أخرى" }] },
      { key: "contract_id", label: "العقد", type: "select", required: true, options: refContracts },
      { key: "bus_id", label: "الحافلة", type: "select", required: true, options: refBuses },
      { key: "subscription_type", label: "نوع الاشتراك", type: "select", required: true, options: [{ value: "Per_Day", label: "يومي" }, { value: "Per_Month", label: "شهري" }, { value: "Per_Trip", label: "بالرحلة" }] },
      { key: "rate", label: "قيمة الاشتراك", type: "number", required: true },
      { key: "pickup_location", label: "موقع الالتقاط", type: "text" },
      { key: "status", label: "الحالة", type: "select", options: [{ value: "Active", label: "نشط" }, { value: "Inactive", label: "غير نشط" }] },
    ],
    payments: [
      { key: "payment_id", label: "معرّف الدفعة", type: "text", required: true },
      { key: "student_id", label: "الطالب", type: "select", required: true, options: refStudents },
      { key: "contract_id", label: "العقد", type: "select", required: true, options: refContracts },
      { key: "amount", label: "المبلغ", type: "number", required: true },
      { key: "payment_method", label: "طريقة الدفع", type: "select", required: true, options: [{ value: "Cash", label: "كاش" }, { value: "Digital", label: "رقمي" }] },
      { key: "payment_status", label: "الحالة", type: "select", options: [{ value: "Pending", label: "بانتظار التأكيد" }, { value: "Confirmed", label: "مؤكدة" }] },
      { key: "payment_date", label: "التاريخ", type: "date" },
    ],
    announcements: [
      { key: "announcement_id", label: "معرّف التعميم", type: "text", required: true },
      { key: "title", label: "العنوان", type: "text", required: true },
      { key: "content", label: "النص", type: "textarea", required: true },
      { key: "announcement_type", label: "النوع", type: "select", required: true, options: [{ value: "Circular", label: "تعميم عادي" }, { value: "Emergency", label: "طارئ" }] },
      { key: "target_audience", label: "الجمهور المستهدف", type: "select", required: true, options: [{ value: "All", label: "الجميع" }, { value: "Specific_Bus", label: "حافلة محددة" }, { value: "Specific_Contract", label: "عقد محدد" }] },
      { key: "target_id", label: "معرّف الحافلة/العقد المستهدف (إن وُجد)", type: "text" },
    ],
    waContacts: [
      { key: "phone_number", label: "رقم الهاتف (صيغة دولية بدون +)", type: "text", required: true, placeholder: "9613XXXXXX" },
      { key: "full_name", label: "الاسم", type: "text" },
      { key: "role", label: "الدور", type: "select", required: true, options: [{ value: "owner", label: "صاحب الأسطول" }, { value: "manager", label: "مدير" }, { value: "driver", label: "سائق" }, { value: "parent", label: "ولي أمر" }] },
      { key: "linked_driver_id", label: "ربط بسائق Buspulse (اختياري)", type: "select", options: refDrivers },
      { key: "linked_guardian_id", label: "ربط بولي أمر Buspulse (اختياري)", type: "select", options: refGuardians },
    ],
    waRoutes: [
      { key: "route_name", label: "اسم المسار", type: "text", required: true },
      { key: "school_name", label: "المدرسة", type: "text" },
      { key: "default_bus_ref", label: "الحافلة الافتراضية", type: "select", options: refBuses },
      { key: "default_driver_id", label: "السائق الافتراضي (يظهر لبوابة المدرسة)", type: "select", options: refWaDrivers },
    ],
    waStudents: [
      { key: "student_name", label: "اسم الطالب", type: "text", required: true },
      { key: "parent_contact_id", label: "ولي الأمر", type: "select", required: true, options: refWaParents },
      { key: "route_id", label: "المسار", type: "select", options: refWaRoutes },
      { key: "station", label: "المحطة", type: "text" },
      { key: "class_level", label: "الصف (لتفعيل أيام الامتحانات)", type: "text", placeholder: "مثلاً: الصف السابع" },
      { key: "linked_student_id", label: "ربط بطالب Buspulse الحقيقي (لتفعيل بوابة المدرسة)", type: "select", options: refStudents },
      { key: "tuition_override", label: "قيمة اشتراك خاصة (اختياري)", type: "number" },
    ],
    waHolidays: [
      { key: "holiday_date", label: "التاريخ", type: "date", required: true },
      { key: "description", label: "الوصف", type: "text" },
    ],
    waExamSchedules: [
      { key: "class_level", label: "الصف", type: "text", required: true, placeholder: "مثلاً: الصف السابع" },
      { key: "exam_date", label: "تاريخ الامتحان", type: "date", required: true },
      { key: "description", label: "الوصف", type: "text" },
    ],
    waOverrides: [
      { key: "scope_type", label: "النطاق", type: "select", required: true, options: [{ value: "route", label: "مسار كامل" }, { value: "student", label: "طالب واحد" }] },
      { key: "route_id", label: "المسار (إذا كان النطاق مسار)", type: "select", options: refWaRoutes },
      { key: "student_id", label: "الطالب (إذا كان النطاق طالب واحد)", type: "select", options: refWaStudents },
      { key: "override_date", label: "التاريخ", type: "date", required: true },
      { key: "is_enabled", label: "الحالة", type: "select", required: true, options: [{ value: "false", label: "تعطيل التذكير هذا اليوم" }, { value: "true", label: "استثناء: تفعيل التذكير رغم أي عطلة/امتحان" }] },
    ],
  };

  const fields = FIELD_CONFIGS[section];
  const suggestedId = section === "buses" ? generateNextId(existingIds, "BUS")
    : section === "drivers" ? generateNextId(existingIds, "DRV")
    : section === "contracts" ? generateNextId(existingIds, "CTR")
    : section === "guardians" ? generateNextId(existingIds, "GRD")
    : section === "students" ? generateNextId(existingIds, "STU")
    : section === "payments" ? generateNextId(existingIds, "PAY")
    : section === "announcements" ? generateNextId(existingIds, "ANN")
    : undefined;

  async function handleAddSubmit(values: Record<string, any>) {
    const cfg = SECTION_QUERY[section];
    if (!cfg) return { error: "خطأ داخلي" };
    const isWa = section.startsWith("wa");

    if (isWa) {
      if (!waTenantId) return { error: "لم يتم تفعيل وحدة الواتساب لهذا الأسطول بعد." };

      let payload: Record<string, any> = { ...values, wa_tenant_id: waTenantId };
      if (section === "waOverrides") {
        payload.is_enabled = values.is_enabled === "true";
        if (values.scope_type === "route") payload.student_id = null;
        else payload.route_id = null;
      }

      const { error } = await supabase.from(cfg.table).insert(payload);
      if (error) return { error: error.message };
      loadSectionRows();
      return { error: null };
    }

    if (!fleetId) return { error: "تعذّر تحديد الأسطول الحالي — أعد تحميل الصفحة." };
    const { error } = await supabase.from(cfg.table).insert({ ...values, fleet_id: fleetId });
    if (error) return { error: error.message };
    loadSectionRows();
    return { error: null };
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 235, background: "var(--navy)", padding: "1.5rem 0", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 1.25rem", marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BusFront size={17} color="white" />
          </div>
          <p style={{ color: "white", fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>Buspulse</p>
        </div>
        {CORE_SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} className={`nav-item ${section === s.id ? "active" : ""}`}>
            <s.icon size={17} />{s.label}
          </button>
        ))}

        <p className="nav-group-label">بوت الواتساب</p>
        {waTenantId === null && (
          <p style={{ padding: "0 1.25rem", fontSize: "0.78rem", color: "#8B99A3" }}>
            غير مفعّل لهذا الأسطول بعد.
          </p>
        )}
        {waTenantId && WA_SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} className={`nav-item ${section === s.id ? "active" : ""}`}>
            <s.icon size={17} />{s.label}
          </button>
        ))}
      </nav>

      <main className="fade-in" style={{ flex: 1, padding: "1.75rem", maxWidth: 1000 }}>
        <SosFeed />
        <KpiCards />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: "1.25rem", margin: 0, color: "var(--navy)" }}>
            {[...CORE_SECTIONS, ...WA_SECTIONS].find((s) => s.id === section)?.label}
          </h2>
          {fields && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary"><Plus size={16} /> إضافة جديد</button>
          )}
        </div>

        {section === "pl" ? (
          <SimpleTable
            columns={[
              { key: "plate_number", label: "الحافلة" }, { key: "month", label: "الشهر" },
              { key: "subscription_revenue", label: "الإيرادات" }, { key: "maintenance_cost", label: "الصيانة" },
              { key: "driver_payroll_cost", label: "الأجور" }, { key: "net_profit", label: "الصافي" },
            ]}
            rows={plRows}
          />
        ) : section === "permissions" ? (
          appUser.tenant_id ? <PermissionsMatrix tenantId={appUser.tenant_id} /> : <p style={{ color: "var(--steel)" }}>تعذّر تحديد الحساب الحالي.</p>
        ) : section === "waRingSchedule" ? (
          waTenantId ? <RingSchedulePanel waTenantId={waTenantId} /> : <p style={{ color: "var(--steel)" }}>وحدة الواتساب غير مفعّلة لهذا الأسطول.</p>
        ) : section === "waPayments" ? (
          waTenantId ? <WaPaymentsPanel waTenantId={waTenantId} /> : <p style={{ color: "var(--steel)" }}>وحدة الواتساب غير مفعّلة لهذا الأسطول.</p>
        ) : section === "waExpenses" ? (
          waTenantId ? <WaExpensesPanel waTenantId={waTenantId} /> : <p style={{ color: "var(--steel)" }}>وحدة الواتساب غير مفعّلة لهذا الأسطول.</p>
        ) : (
          SECTION_QUERY[section] && <SimpleTable columns={SECTION_QUERY[section]!.columns} rows={rows} />
        )}
      </main>

      {showAddModal && fields && (
        <AddEntityModal
          title={`إضافة ${[...CORE_SECTIONS, ...WA_SECTIONS].find((s) => s.id === section)?.label}`}
          fields={fields}
          initialValues={suggestedId ? { [fields[0].key]: suggestedId } : undefined}
          onSubmit={handleAddSubmit}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
