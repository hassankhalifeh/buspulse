"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Siren, Check, RotateCcw } from "lucide-react";

export default function SOSButton({ busId, driverId }: { busId: string; driverId: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [confirming, setConfirming] = useState(false);

  function handlePress() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setStatus("sending");

    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { error } = await supabase.from("sos_alerts").insert({
          alert_id: `SOS-${Date.now()}`, bus_id: busId, driver_id: driverId,
          latitude: position.coords.latitude, longitude: position.coords.longitude, status: "Active",
        });
        setStatus(error ? "error" : "sent");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 22, insetInlineEnd: 22, zIndex: 50, textAlign: "center" }}>
      {confirming && status === "idle" && (
        <p className="fade-in" style={{ background: "var(--navy)", color: "white", borderRadius: 999, padding: "7px 14px", fontSize: "0.8rem", fontWeight: 600, boxShadow: "var(--shadow-md)", marginBottom: 8 }}>
          اضغط مجدداً للتأكيد
        </p>
      )}
      <button
        onClick={handlePress}
        onBlur={() => setConfirming(false)}
        disabled={status === "sending"}
        className={status === "idle" && !confirming ? "pulse-armed" : undefined}
        style={{ width: confirming ? 92 : 74, height: confirming ? 92 : 74, borderRadius: "50%", border: "none", background: status === "sent" ? "var(--steel-light)" : "var(--red)", color: "white", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", boxShadow: "var(--shadow-lg)", transition: "width 0.15s ease, height 0.15s ease, background 0.15s ease", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}
      >
        {status === "idle" && !confirming && (<><Siren size={24} /><span>SOS</span></>)}
        {status === "idle" && confirming && <span>تأكيد؟</span>}
        {status === "sending" && <span>...</span>}
        {status === "sent" && (<><Check size={22} /><span>تم</span></>)}
        {status === "error" && (<><RotateCcw size={20} /><span>خطأ</span></>)}
      </button>
    </div>
  );
}
