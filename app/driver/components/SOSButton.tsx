"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Siren, Check, RotateCcw } from "lucide-react";

export default function SOSButton({ busId, driverId }: { busId: string; driverId: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [confirming, setConfirming] = useState(false);
  const [errorText, setErrorText] = useState("");

  function handlePress() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setErrorText("");
    setStatus("sending");

    if (!("geolocation" in navigator)) {
      setErrorText("المتصفح لا يدعم تحديد الموقع.");
      setStatus("error");
      return;
    }

    const send = async (position: GeolocationPosition) => {
      const { error } = await supabase.from("sos_alerts").insert({
        alert_id: `SOS-${Date.now()}`, bus_id: busId, driver_id: driverId,
        latitude: position.coords.latitude, longitude: position.coords.longitude, status: "Active",
      });
      if (error) setErrorText(`تعذّر إرسال التنبيه: ${error.message}`);
      setStatus(error ? "error" : "sent");
    };
    const fail = (err: GeolocationPositionError) => {
      setErrorText(
        err.code === err.PERMISSION_DENIED
          ? "الموقع مرفوض. اسمح للموقع في إعدادات المتصفح ثم أعد المحاولة."
          : "تعذّر تحديد موقعك. تأكد من تشغيل GPS وأعد المحاولة."
      );
      setStatus("error");
    };

    // First try an accurate fix; if that times out or fails (common indoors / on desktops),
    // retry with a coarse, possibly cached position rather than losing the alert.
    navigator.geolocation.getCurrentPosition(
      send,
      (firstErr) => {
        if (firstErr.code === firstErr.PERMISSION_DENIED) { fail(firstErr); return; }
        navigator.geolocation.getCurrentPosition(send, fail, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 22, insetInlineEnd: 22, zIndex: 50, textAlign: "center" }}>
      {status === "error" && errorText && (
        <p className="fade-in" style={{ background: "var(--red)", color: "white", borderRadius: 12, padding: "8px 12px", fontSize: "0.8rem", fontWeight: 600, boxShadow: "var(--shadow-md)", marginBottom: 8, maxWidth: 260 }}>
          {errorText}
        </p>
      )}
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
