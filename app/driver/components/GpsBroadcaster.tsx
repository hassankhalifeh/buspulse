"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Radio } from "lucide-react";

export default function GpsBroadcaster({ busId, tripId }: { busId: string; tripId?: string }) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  function start() {
    if (!("geolocation" in navigator)) {
      setLastError("الموقع الجغرافي غير مدعوم على هذا الجهاز");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const { error } = await supabase.from("gps_tracking").insert({
          bus_id: busId, trip_id: tripId ?? null, latitude, longitude, is_broadcast_active: true,
        });
        if (error) setLastError(error.message);
      },
      (geoError) => setLastError(geoError.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setIsBroadcasting(true);
  }

  async function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsBroadcasting(false);
    await supabase.from("gps_tracking").insert({
      bus_id: busId, trip_id: tripId ?? null, latitude: 0, longitude: 0, is_broadcast_active: false,
    });
  }

  return (
    <div className="card" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={isBroadcasting ? "pulse-live" : undefined} style={{ width: 34, height: 34, borderRadius: "50%", background: isBroadcasting ? "var(--green)" : "var(--fog)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Radio size={16} color={isBroadcasting ? "white" : "var(--steel)"} />
          </div>
          <span style={{ fontWeight: 700, fontSize: "0.98rem" }}>بث الموقع لأولياء الأمور</span>
        </div>
        <button onClick={isBroadcasting ? stop : start} className="btn" style={{ borderRadius: 999, color: "white", background: isBroadcasting ? "var(--red)" : "var(--green)", fontSize: "0.9rem", padding: "9px 20px" }}>
          {isBroadcasting ? "إيقاف البث" : "تفعيل البث"}
        </button>
      </div>
      {lastError && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginTop: 10 }}>{lastError}</p>}
    </div>
  );
}
