"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { SosAlert } from "@/lib/types";
import { useAppUser } from "@/lib/useAppUser";
import { Siren, MapPin, CheckCircle2 } from "lucide-react";

export default function SosFeed() {
  const { appUser } = useAppUser();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  async function resolve(alertId: string) {
    if (!window.confirm("تأكيد إغلاق هذا التنبيه كمحلول؟")) return;
    setResolving(alertId);
    const { error } = await supabase.from("sos_alerts")
      .update({ status: "Resolved", resolved_at: new Date().toISOString(), resolved_by: appUser?.id ?? null })
      .eq("alert_id", alertId);
    setResolving(null);
    if (error) { alert(`تعذّر إغلاق التنبيه: ${error.message}`); return; }
    setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }

  useEffect(() => {
    supabase.from("sos_alerts").select("*").eq("status", "Active")
      .order("event_timestamp", { ascending: false }).then(({ data }) => setAlerts(data ?? []));

    const channel = supabase.channel("sos-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sos_alerts" },
        (payload) => setAlerts((prev) => [payload.new as SosAlert, ...prev]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="pulse-armed fade-in" style={{ background: "var(--red)", color: "white", borderRadius: "var(--radius-md)", padding: "1.1rem 1.3rem", marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Siren size={20} />
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>تنبيهات طوارئ نشطة ({alerts.length})</h3>
      </div>
      {alerts.map((a) => (
        <div key={a.alert_id} style={{ fontSize: "0.88rem", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span className="id-code">حافلة {a.bus_id}</span> — {new Date(a.event_timestamp).toLocaleTimeString("ar")} —
          <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" style={{ color: "white", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MapPin size={13} /> عرض الموقع
          </a>
          <button onClick={() => resolve(a.alert_id)} disabled={resolving === a.alert_id}
            style={{ marginInlineStart: "auto", background: "white", color: "var(--red)", border: "none", borderRadius: 8, padding: "4px 10px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={14} /> {resolving === a.alert_id ? "..." : "تم الحل"}
          </button>
        </div>
      ))}
    </div>
  );
}
