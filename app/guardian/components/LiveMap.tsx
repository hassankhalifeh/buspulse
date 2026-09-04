"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { GpsPing } from "@/lib/types";
import { MapPin, ExternalLink } from "lucide-react";

export default function LiveMap({ busId }: { busId: string }) {
  const [ping, setPing] = useState<GpsPing | null>(null);

  useEffect(() => {
    supabase.from("gps_tracking").select("*").eq("bus_id", busId)
      .order("event_timestamp", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPing(data));

    const channel = supabase
      .channel(`gps-${busId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gps_tracking", filter: `bus_id=eq.${busId}` },
        (payload) => setPing(payload.new as GpsPing))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [busId]);

  if (!ping || !ping.is_broadcast_active) {
    return (
      <div className="card" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
        <p style={{ color: "var(--steel)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={16} /> البث غير مفعّل حالياً من قبل السائق.
        </p>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps?q=${ping.latitude},${ping.longitude}`;

  return (
    <div className="card" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="pulse-dot-indicator" />
        <p style={{ fontWeight: 700, margin: 0 }}>البث مفعّل الآن</p>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--steel)", marginBottom: 10 }}>
        آخر تحديث: {new Date(ping.event_timestamp).toLocaleTimeString("ar")}
      </p>
      <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--red)", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
        فتح الموقع على خرائط Google <ExternalLink size={14} />
      </a>
    </div>
  );
}
