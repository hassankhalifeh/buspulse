"use client";

import { useEffect, useState } from "react";
import { useAppUser } from "@/lib/useAppUser";
import { supabase } from "@/lib/supabaseClient";
import { UserRound } from "lucide-react";
import LiveMap from "./components/LiveMap";
import AnnouncementsList from "./components/AnnouncementsList";

interface ChildRow { student_id: string; full_name: string; bus_id: string; contract_id: string; }

export default function GuardianPage() {
  const { appUser, loading } = useAppUser();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser?.guardian_id) return;
    supabase.from("students").select("student_id, full_name, bus_id, contract_id")
      .eq("guardian_id", appUser.guardian_id)
      .then(({ data }) => {
        setChildren(data ?? []);
        if (data && data.length > 0) setActiveChildId(data[0].student_id);
      });
  }, [appUser]);

  if (loading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;
  if (!appUser || appUser.role !== "guardian") {
    return <p style={{ padding: 24, color: "var(--steel)" }}>هذه الصفحة مخصصة لأولياء الأمور فقط.</p>;
  }

  const activeChild = children.find((c) => c.student_id === activeChildId) ?? null;

  return (
    <main className="fade-in" style={{ maxWidth: 480, margin: "0 auto", padding: "1.75rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.4rem", color: "var(--navy)", marginBottom: 4, fontWeight: 800 }}>مرحباً {appUser.full_name}</h1>
      <div className="route-divider" style={{ width: 90, marginBottom: 20 }} />

      {children.length === 0 && <p style={{ color: "var(--steel)" }}>لا يوجد ركاب مرتبطين بحسابك حالياً.</p>}

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto" }}>
          {children.map((child) => {
            const active = activeChildId === child.student_id;
            return (
              <button key={child.student_id} onClick={() => setActiveChildId(child.student_id)} className="btn"
                style={{ borderRadius: 999, whiteSpace: "nowrap", fontSize: "0.88rem", padding: "9px 18px", background: active ? "var(--navy)" : "white", color: active ? "white" : "var(--steel)", boxShadow: active ? "var(--shadow-sm)" : "none" }}>
                <UserRound size={14} /> {child.full_name}
              </button>
            );
          })}
        </div>
      )}

      {activeChild && (
        <>
          {children.length === 1 && <h2 style={{ fontSize: "1.05rem", color: "#333", marginBottom: 12 }}>{activeChild.full_name}</h2>}
          <LiveMap busId={activeChild.bus_id} />
          <AnnouncementsList busIds={[activeChild.bus_id]} contractIds={[activeChild.contract_id]} />
        </>
      )}
    </main>
  );
}
