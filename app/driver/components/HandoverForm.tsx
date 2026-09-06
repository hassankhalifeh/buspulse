"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, Circle, ClipboardCheck } from "lucide-react";

interface TodayHandover { handover_id: string; shift_type: string; created_at: string; }

const CHECKLIST_ITEMS = [
  { key: "tires", label: "الإطارات سليمة" },
  { key: "lights", label: "الأضواء سليمة" },
  { key: "brakes", label: "الفرامل سليمة" },
  { key: "cleanliness", label: "النظافة مقبولة" },
] as const;

export default function HandoverForm({ busId, driverId }: { busId: string; driverId: string }) {
  const [todayEntry, setTodayEntry] = useState<TodayHandover | null | undefined>(undefined);
  const [showFormAnyway, setShowFormAnyway] = useState(false);
  const [odometerStart, setOdometerStart] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [checks, setChecks] = useState({ tires: true, lights: true, brakes: true, cleanliness: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from("handover_log").select("handover_id, shift_type, created_at")
      .eq("bus_id", busId).eq("driver_id", driverId).eq("handover_date", today)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setTodayEntry(data));
  }, [busId, driverId, saved]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("handover_log").insert({
      handover_id: `HO-${Date.now()}`, bus_id: busId, driver_id: driverId,
      handover_date: new Date().toISOString().slice(0, 10),
      shift_type: new Date().getHours() < 13 ? "Morning" : "Evening",
      odometer_start: Number(odometerStart) || null, fuel_level_percent: Number(fuelLevel) || null,
      checklist_tires_ok: checks.tires, checklist_lights_ok: checks.lights,
      checklist_brakes_ok: checks.brakes, checklist_cleanliness_ok: checks.cleanliness,
      damage_notes: damageNotes, driver_signature_confirmed: true,
    });
    if (!error) { setSaved(true); setShowFormAnyway(false); }
  }

  if (todayEntry === undefined) return null;

  if (todayEntry && !showFormAnyway) {
    return (
      <div className="card fade-in" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={22} color="var(--green)" />
          <p style={{ margin: 0, fontWeight: 700, color: "var(--green)" }}>
            تم استلام الحافلة اليوم ({todayEntry.shift_type === "Morning" ? "صباحي" : "مسائي"} — {new Date(todayEntry.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })})
          </p>
        </div>
        <button onClick={() => setShowFormAnyway(true)} style={{ marginTop: 10, background: "none", border: "none", color: "var(--steel)", fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
          تسجيل استلام إضافي (مثلاً وردية مسائية)
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card fade-in" style={{ padding: "1.2rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <ClipboardCheck size={20} color="var(--navy)" />
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>استلام الحافلة اليومي</h3>
      </div>
      <input placeholder="قراءة العداد" value={odometerStart} onChange={(e) => setOdometerStart(e.target.value)} className="input" style={{ marginBottom: 10 }} />
      <input placeholder="نسبة الوقود %" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} className="input" style={{ marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {CHECKLIST_ITEMS.map(({ key, label }) => {
          const checked = checks[key];
          return (
            <button type="button" key={key} onClick={() => setChecks({ ...checks, [key]: !checked })}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: "var(--radius-sm)", border: `1.5px solid ${checked ? "var(--green)" : "var(--fog-dark)"}`, background: checked ? "#eaf4ea" : "white", cursor: "pointer", fontSize: "0.88rem", fontFamily: "inherit", color: checked ? "var(--green)" : "var(--steel)", textAlign: "right", transition: "all 0.12s ease" }}>
              {checked ? <CheckCircle2 size={17} /> : <Circle size={17} />}
              {label}
            </button>
          );
        })}
      </div>
      <textarea placeholder="ملاحظات خدوش/أضرار (إن وُجدت)" value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} className="input" style={{ height: 64, resize: "vertical", marginBottom: 14 }} />
      <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>{saved ? "تم الحفظ ✓" : "تأكيد الاستلام"}</button>
    </form>
  );
}
