"use client";

import { useEffect, useState } from "react";
import { useAppUser } from "@/lib/useAppUser";
import { supabase } from "@/lib/supabaseClient";
import type { Bus } from "@/lib/types";
import { Repeat, BusFront } from "lucide-react";
import HandoverForm from "./components/HandoverForm";
import GpsBroadcaster from "./components/GpsBroadcaster";
import SOSButton from "./components/SOSButton";
import BusPicker from "./components/BusPicker";

export default function DriverPage() {
  const { appUser, loading } = useAppUser();
  const [assignedBuses, setAssignedBuses] = useState<Bus[] | null>(null);
  const [activeBus, setActiveBus] = useState<Bus | null>(null);

  useEffect(() => {
    if (!appUser?.driver_id) return;
    supabase
      .from("driver_bus_assignments")
      .select("bus_id, buses(*)")
      .eq("driver_id", appUser.driver_id)
      .eq("is_active", true)
      .then(({ data }) => {
        const buses = (data ?? []).map((row: any) => row.buses).filter(Boolean) as Bus[];
        setAssignedBuses(buses);
        if (buses.length === 1) setActiveBus(buses[0]);
      });
  }, [appUser]);

  if (loading || (appUser?.driver_id && assignedBuses === null)) {
    return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  }
  if (!appUser || appUser.role !== "driver" || !appUser.driver_id) {
    return <p style={{ padding: 24, color: "var(--steel)" }}>هذه الصفحة مخصصة للسائقين فقط.</p>;
  }
  if (assignedBuses && assignedBuses.length === 0) {
    return <p style={{ padding: 24, color: "var(--steel)" }}>لا توجد حافلة مسندة إليك بعد — تواصل مع الإدارة.</p>;
  }
  if (assignedBuses && assignedBuses.length > 1 && !activeBus) {
    return <BusPicker buses={assignedBuses} onSelect={setActiveBus} />;
  }

  const bus = activeBus;

  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--navy)", color: "white", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--navy-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BusFront size={19} color="white" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>{appUser.full_name}</p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--steel-light)" }}>
              {bus ? `الحافلة: ${bus.plate_number}` : "لا توجد حافلة مسندة بعد"}
            </p>
          </div>
        </div>
        {assignedBuses && assignedBuses.length > 1 && (
          <button onClick={() => setActiveBus(null)} className="btn" style={{ background: "rgba(255,255,255,0.08)", color: "white", padding: "8px 14px", fontSize: "0.85rem" }}>
            <Repeat size={14} /> تبديل الحافلة
          </button>
        )}
      </header>

      <main className="fade-in" style={{ maxWidth: 480, margin: "0 auto", padding: "1.25rem 1rem" }}>
        {bus && <HandoverForm busId={bus.bus_id} driverId={appUser.driver_id} />}
        {bus && <GpsBroadcaster busId={bus.bus_id} />}
      </main>

      <SOSButton busId={bus?.bus_id ?? ""} driverId={appUser.driver_id} />
    </>
  );
}
