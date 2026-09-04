"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppUser } from "@/lib/useAppUser";
import { supabase } from "@/lib/supabaseClient";
import type { ClientTrip, School, FleetSchoolLink } from "@/lib/types";
import { Building2, Phone, Users, MapPin, User } from "lucide-react";

type DateFilter = "today" | "week" | "all";

interface WaClientRouteStatus {
  student_id: string;
  student_name: string;
  route_name: string | null;
  scheduled_outbound_time: string | null;
  scheduled_return_time: string | null;
  actual_outbound_time: string | null;
  actual_return_time: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

function filterStartDate(filter: DateFilter): string | null {
  const today = new Date();
  if (filter === "today") return today.toISOString().slice(0, 10);
  if (filter === "week") {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return weekAgo.toISOString().slice(0, 10);
  }
  return null;
}

export default function ClientPortalPage() {
  const { appUser, loading } = useAppUser();
  const [school, setSchool] = useState<School | null>(null);
  const [links, setLinks] = useState<FleetSchoolLink[]>([]);
  const [fleetFilter, setFleetFilter] = useState<string | "all">("all");
  const [trips, setTrips] = useState<ClientTrip[]>([]);
  const [passengerCount, setPassengerCount] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [waRouteStatus, setWaRouteStatus] = useState<WaClientRouteStatus[]>([]);

  useEffect(() => {
    if (!school) return;
    // Bot-tracked live status — see buspulse-whatsapp/08_school_portal_visibility.sql.
    // Gracefully empty (not an error) for a fleet that hasn't set this up,
    // or before file 08 has been run on this project.
    supabase.from("v_wa_client_route_status").select("*")
      .then(({ data, error }) => {
        if (error) { console.warn("WA route status not available:", error.message); return; }
        setWaRouteStatus((data as any) ?? []);
      });
  }, [school]);

  useEffect(() => {
    if (!appUser || appUser.role !== "client_viewer" || !appUser.tenant_id) return;
    supabase.from("schools").select("*").eq("tenant_id", appUser.tenant_id).maybeSingle()
      .then(({ data }) => setSchool(data));
  }, [appUser]);

  useEffect(() => {
    if (!school) return;
    supabase.from("fleet_school_links")
      .select("fleet_id, school_id, status, fleets(fleet_id, company_name, contact_phone, contact_email)")
      .eq("school_id", school.school_id).eq("status", "active")
      .then(({ data }) => setLinks((data as any) ?? []));
  }, [school]);

  useEffect(() => {
    if (!school) return;
    let query = supabase.from("trips")
      .select("trip_id, contract_id, fleet_id, route_name, trip_date, scheduled_start_time, scheduled_end_time, status, buses(plate_number, model)")
      .order("trip_date", { ascending: false });
    const start = filterStartDate(dateFilter);
    if (start) query = query.gte("trip_date", start);
    if (fleetFilter !== "all") query = query.eq("fleet_id", fleetFilter);
    query.then(({ data }) => setTrips((data as any) ?? []));
  }, [school, dateFilter, fleetFilter]);

  useEffect(() => {
    if (!school) return;
    supabase.from("students").select("student_id", { count: "exact", head: true })
      .then(({ count }) => setPassengerCount(count));
  }, [school]);

  const fleetNameById = useMemo(() => {
    const map: Record<string, string> = {};
    links.forEach((l) => (map[l.fleet_id] = l.fleets.company_name));
    return map;
  }, [links]);

  if (loading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  if (!appUser || appUser.role !== "client_viewer") {
    return <p style={{ padding: 24, color: "var(--steel)" }}>هذه الصفحة مخصصة لجهة العقد (مثل المدرسة) فقط.</p>;
  }

  return (
    <main className="fade-in" style={{ maxWidth: 820, margin: "0 auto", padding: "1.75rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.4rem", color: "var(--navy)", marginBottom: 4, fontWeight: 800 }}>
        متابعة الرحلات{school ? ` — ${school.school_name}` : ""}
      </h1>
      <div className="route-divider" style={{ width: 100, marginBottom: 18 }} />

      {links.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {links.map((l) => (
            <div key={l.fleet_id} className="card" style={{ padding: "10px 14px", fontSize: "0.85rem", color: "var(--steel)", display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={15} color="var(--navy)" />
              <strong style={{ color: "var(--navy)" }}>{l.fleets.company_name}</strong>
              {l.fleets.contact_phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {l.fleets.contact_phone}</span>}
            </div>
          ))}
        </div>
      )}

      {passengerCount !== null && (
        <p style={{ fontSize: "0.9rem", color: "var(--steel)", marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={15} /> عدد الركاب المسجّلين: <strong style={{ color: "var(--navy)" }}>{passengerCount}</strong>
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {([["today", "اليوم"], ["week", "هذا الأسبوع"], ["all", "الكل"]] as [DateFilter, string][]).map(([value, label]) => (
          <button key={value} onClick={() => setDateFilter(value)} className="btn"
            style={{ borderRadius: 999, fontSize: "0.85rem", padding: "8px 18px", background: dateFilter === value ? "var(--navy)" : "white", color: dateFilter === value ? "white" : "var(--steel)", boxShadow: dateFilter === value ? "var(--shadow-sm)" : "none" }}>
            {label}
          </button>
        ))}
        {links.length > 1 && (
          <select value={fleetFilter} onChange={(e) => setFleetFilter(e.target.value)} className="input" style={{ width: "auto", borderRadius: 999, padding: "8px 16px", fontSize: "0.85rem" }}>
            <option value="all">كل الأساطيل</option>
            {links.map((l) => <option key={l.fleet_id} value={l.fleet_id}>{l.fleets.company_name}</option>)}
          </select>
        )}
      </div>

      {waRouteStatus.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem", color: "var(--navy)", marginBottom: 10 }}>الموعد المجدول والفعلي (عبر بوت الواتساب)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 22 }}>
            {waRouteStatus.map((r) => (
              <div key={r.student_id} className="card" style={{ padding: "14px 16px" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>{r.student_name}</p>
                <p style={{ margin: "2px 0 8px", fontSize: "0.78rem", color: "var(--steel)" }}>{r.route_name ?? "—"}</p>

                <div style={{ fontSize: "0.8rem", marginBottom: 4 }}>
                  <span style={{ color: "var(--steel)" }}>الذهاب — مجدول: </span>{r.scheduled_outbound_time ?? "—"}
                  {r.actual_outbound_time && (
                    <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <MapPin size={12} /> فعلياً: {new Date(r.actual_outbound_time).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "0.8rem", marginBottom: 8 }}>
                  <span style={{ color: "var(--steel)" }}>الإياب — مجدول: </span>{r.scheduled_return_time ?? "—"}
                  {r.actual_return_time && (
                    <span style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <MapPin size={12} /> فعلياً: {new Date(r.actual_return_time).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {r.driver_name && (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--steel)", display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={12} /> {r.driver_name}{r.driver_phone ? ` — ${r.driver_phone}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>التاريخ</th><th>المسار</th><th>الحافلة</th>
              {links.length > 1 && <th>الأسطول</th>}
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.trip_id}>
                <td>{t.trip_date}</td>
                <td>{t.route_name}</td>
                <td className="id-code">{t.buses?.plate_number}</td>
                {links.length > 1 && <td>{fleetNameById[t.fleet_id] ?? "—"}</td>}
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trips.length === 0 && <p style={{ color: "var(--steel)", marginTop: 14, fontSize: "0.88rem" }}>لا توجد رحلات ضمن هذه الفترة.</p>}
    </main>
  );
}
