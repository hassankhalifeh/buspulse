"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { FleetInfo } from "@/lib/useFleetInfo";

const CURRENCIES = ["USD", "LBP", "EUR", "SAR", "AED", "JOD", "EGP", "TRY"];
const TIMEZONES = ["Asia/Beirut", "Asia/Riyadh", "Asia/Dubai", "Asia/Amman", "Asia/Baghdad", "Africa/Cairo", "Europe/Istanbul", "Europe/Paris", "UTC"];

interface Props {
  fleet: FleetInfo;
  submitLabel: string;
  markCompleted?: boolean; // onboarding: also flips onboarding_completed
  onSaved: () => void;
}

const label: React.CSSProperties = { fontSize: "0.85rem", color: "#333", fontWeight: 600, display: "block", marginTop: 12 };
const field: React.CSSProperties = { marginTop: 6, width: "100%" };

// Every piece of information that distinguishes one fleet from another. Saved straight into that fleet's
// own row (RLS lets a fleet's owner/admin change only their own fleet).
export default function FleetInfoForm({ fleet, submitLabel, markCompleted, onSaved }: Props) {
  const [form, setForm] = useState({
    company_name: fleet.company_name ?? "",
    contact_person: fleet.contact_person ?? "",
    contact_phone: fleet.contact_phone ?? "",
    contact_email: fleet.contact_email ?? "",
    address: fleet.address ?? "",
    city: fleet.city ?? "",
    country: fleet.country ?? "",
    registration_number: fleet.registration_number ?? "",
    currency: fleet.currency ?? "USD",
    timezone: fleet.timezone ?? "Asia/Beirut",
    working_hours: fleet.working_hours ?? "",
    logo_url: fleet.logo_url ?? "",
    notes: fleet.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (form.company_name.trim().length < 2) return setMessage({ ok: false, text: "اسم الشركة مطلوب." });
    if (form.contact_phone.trim().length < 6) return setMessage({ ok: false, text: "رقم هاتف التواصل مطلوب." });
    if (form.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact_email.trim()))
      return setMessage({ ok: false, text: "البريد الإلكتروني غير صالح." });
    if (form.logo_url.trim() && !/^https?:\/\//i.test(form.logo_url.trim()))
      return setMessage({ ok: false, text: "رابط الشعار يجب أن يبدأ بـ https://" });

    const nullable = (v: string) => (v.trim() ? v.trim() : null);
    const update: Record<string, unknown> = {
      company_name: form.company_name.trim(),
      contact_person: nullable(form.contact_person),
      contact_phone: form.contact_phone.trim(),
      contact_email: nullable(form.contact_email),
      address: nullable(form.address),
      city: nullable(form.city),
      country: nullable(form.country),
      registration_number: nullable(form.registration_number),
      currency: form.currency,
      timezone: form.timezone,
      working_hours: nullable(form.working_hours),
      logo_url: nullable(form.logo_url),
      notes: nullable(form.notes),
    };
    if (markCompleted) update.onboarding_completed = true;

    setSaving(true);
    const { error } = await supabase.from("fleets").update(update).eq("fleet_id", fleet.fleet_id);
    setSaving(false);
    if (error) return setMessage({ ok: false, text: `تعذّر الحفظ: ${error.message}` });

    setMessage({ ok: true, text: "تم الحفظ ✓" });
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={label}>اسم الشركة / الأسطول *</label>
      <input className="input" style={field} value={form.company_name} onChange={set("company_name")} maxLength={120} required />

      <label style={label}>اسم المسؤول عن التواصل</label>
      <input className="input" style={field} value={form.contact_person} onChange={set("contact_person")} maxLength={100} />

      <label style={label}>هاتف التواصل *</label>
      <input className="input" style={field} value={form.contact_phone} onChange={set("contact_phone")} maxLength={25} required />

      <label style={label}>البريد الإلكتروني للتواصل</label>
      <input className="input" style={field} type="email" value={form.contact_email} onChange={set("contact_email")} maxLength={120} />

      <label style={label}>العنوان</label>
      <input className="input" style={field} value={form.address} onChange={set("address")} maxLength={250} />

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>المدينة</label>
          <input className="input" style={field} value={form.city} onChange={set("city")} maxLength={80} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>الدولة</label>
          <input className="input" style={field} value={form.country} onChange={set("country")} maxLength={80} />
        </div>
      </div>

      <label style={label}>رقم السجل التجاري / الترخيص</label>
      <input className="input" style={field} value={form.registration_number} onChange={set("registration_number")} maxLength={60} />

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>العملة</label>
          <select className="input" style={field} value={form.currency} onChange={set("currency")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>المنطقة الزمنية</label>
          <select className="input" style={field} value={form.timezone} onChange={set("timezone")}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <label style={label}>ساعات العمل</label>
      <input className="input" style={field} value={form.working_hours} onChange={set("working_hours")} maxLength={120} placeholder="مثال: الاثنين–السبت 6:00 – 18:00" />

      <label style={label}>رابط الشعار (اختياري)</label>
      <input className="input" style={field} dir="ltr" value={form.logo_url} onChange={set("logo_url")} maxLength={300} placeholder="https://..." />

      <label style={label}>ملاحظات</label>
      <textarea className="input" style={{ ...field, minHeight: 70 }} value={form.notes} onChange={set("notes")} maxLength={500} />

      {message && (
        <p style={{ color: message.ok ? "green" : "var(--red)", fontSize: "0.88rem", marginTop: 12 }}>{message.text}</p>
      )}

      <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: "100%", marginTop: 16 }}>
        {saving ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
