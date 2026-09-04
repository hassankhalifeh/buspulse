"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { SosAlert } from "@/lib/types";
import { Siren, MapPin } from "lucide-react";

export default function SosFeed() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);

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
        </div>
      ))}
    </div>
  );
}
