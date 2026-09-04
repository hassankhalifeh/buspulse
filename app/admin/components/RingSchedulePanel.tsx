"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Phone, PhoneOff, Plus, Trash2, AlertTriangle } from "lucide-react";

interface RingSchedule {
  id: string;
  target_type: "route" | "driver";
  route_id: string | null;
  driver_contact_id: string | null;
  scheduled_time: string;
  ring_count: number;
  ring_duration_seconds: number;
  is_active: boolean;
}

// The exact warning text the fleet owner asked to always show next to
// these controls, verbatim — this is intentionally hardcoded text,
// not a database value (see buspulse-whatsapp/06's closing note).
const RING_COST_WARNING = "انتبه لكلفة المكالمة الهاتفية التي سيتم احتسابها في حال فتح الخط من الطرف المقابل";

export default function RingSchedulePanel({ waTenantId }: { waTenantId: string }) {
  const [ringEnabled, setRingEnabled] = useState(false);
  const [schedules, setSchedules] = useState<RingSchedule[]>([]);
  const [routes, setRoutes] = useState<{ value: string; label: string }[]>([]);
  const [drivers, setDrivers] = useState<{ value: string; label: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<"route" | "driver">("route");
  const [targetId, setTargetId] = useState("");
  const [time, setTime] = useState("07:00");
  const [ringCount, setRingCount] = useState(2);
  const [ringDuration, setRingDuration] = useState(2);

  function load() {
    supabase.from("wa_tenants").select("ring_feature_enabled").eq("id", waTenantId).maybeSingle()
      .then(({ data }) => setRingEnabled(!!data?.ring_feature_enabled));
    supabase.from("wa_ring_schedules").select("*").eq("wa_tenant_id", waTenantId).order("scheduled_time")
      .then(({ data }) => setSchedules((data as any) ?? []));
    supabase.from("wa_routes").select("id, route_name").eq("wa_tenant_id", waTenantId)
      .then(({ data }) => setRoutes((data ?? []).map((r) => ({ value: r.id, label: r.route_name }))));
    supabase.from("wa_contacts").select("id, full_name, phone_number").eq("wa_tenant_id", waTenantId).eq("role", "driver")
      .then(({ data }) => setDrivers((data ?? []).map((d) => ({ value: d.id, label: d.full_name ?? d.phone_number }))));
  }

  useEffect(() => { load(); }, [waTenantId]);

  async function toggleMaster() {
    const next = !ringEnabled;
    const { error: err } = await supabase.from("wa_tenants").update({ ring_feature_enabled: next }).eq("id", waTenantId);
    if (!err) setRingEnabled(next);
  }

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: any = {
      wa_tenant_id: waTenantId, target_type: targetType,
      scheduled_time: time, ring_count: ringCount, ring_duration_seconds: ringDuration,
      route_id: targetType === "route" ? targetId : null,
      driver_contact_id: targetType === "driver" ? targetId : null,
    };
    const { error: err } = await supabase.from("wa_ring_schedules").insert(payload);
    if (err) { setError(err.message); return; }
    setShowForm(false);
    setTargetId("");
    load();
  }

  async function removeSchedule(id: string) {
    await supabase.from("wa_ring_schedules").delete().eq("id", id);
    load();
  }

  const nameFor = (s: RingSchedule) =>
    s.target_type === "route"
      ? routes.find((r) => r.value === s.route_id)?.label ?? "مسار"
      : drivers.find((d) => d.value === s.driver_contact_id)?.label ?? "سائق";

  return (
    <div>
      {/* Master switch — the whole feature is OFF by default until
          the owner deliberately turns it on. */}
      <div className="card" style={{ padding: "1.1rem 1.3rem", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>ميزة التذكير الهاتفي (Flash Call)</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: ringEnabled ? "var(--green)" : "var(--steel)" }}>
            {ringEnabled ? "مفعّلة حالياً" : "معطّلة حالياً"}
          </p>
        </div>
        <button onClick={toggleMaster} className="btn" style={{ background: ringEnabled ? "var(--red)" : "var(--green)", color: "white" }}>
          {ringEnabled ? <><PhoneOff size={15} /> إيقاف الميزة</> : <><Phone size={15} /> تفعيل الميزة</>}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FBF3E3", border: "1px solid #E8CE8E", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 18 }}>
        <AlertTriangle size={16} color="#A97F28" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#7A5D1E" }}>{RING_COST_WARNING}</p>
      </div>

      <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginBottom: 14 }}>
        <Plus size={15} /> إضافة توقيت رنين
      </button>

      {schedules.length === 0 && <p style={{ color: "var(--steel)" }}>لا توجد أوقات مجدولة بعد.</p>}

      {schedules.map((s) => (
        <div key={s.id} className="card" style={{ padding: "0.9rem 1.1rem", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem" }}>
              {s.target_type === "route" ? "مسار" : "سائق"}: {nameFor(s)} — الساعة {s.scheduled_time}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--steel)" }}>
              {s.ring_count} رنّة × {s.ring_duration_seconds} ثانية
            </p>
          </div>
          <button onClick={() => removeSchedule(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {showForm && (
        <div onClick={() => setShowForm(false)} className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(27,42,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={addSchedule} className="card" style={{ padding: "1.5rem", width: 420, maxWidth: "100%" }}>
            <h3 style={{ marginTop: 0, fontSize: "1.05rem", color: "var(--navy)" }}>توقيت رنين جديد</h3>

            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>النوع</label>
            <select value={targetType} onChange={(e) => { setTargetType(e.target.value as any); setTargetId(""); }} className="input" style={{ margin: "6px 0 12px" }}>
              <option value="route">مسار (تذكير لأولياء الأمور)</option>
              <option value="driver">سائق</option>
            </select>

            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>{targetType === "route" ? "المسار" : "السائق"}</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required className="input" style={{ margin: "6px 0 12px" }}>
              <option value="">— اختر —</option>
              {(targetType === "route" ? routes : drivers).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>الوقت</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="input" style={{ margin: "6px 0 12px" }} />

            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>عدد الرنات (١-٣)</label>
            <input type="number" min={1} max={3} value={ringCount} onChange={(e) => setRingCount(e.target.valueAsNumber)} className="input" style={{ margin: "6px 0 12px" }} />

            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>مدة كل رنة بالثواني (١-٣)</label>
            <input type="number" min={1} max={3} value={ringDuration} onChange={(e) => setRingDuration(e.target.valueAsNumber)} className="input" style={{ margin: "6px 0 12px" }} />

            {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>حفظ</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
