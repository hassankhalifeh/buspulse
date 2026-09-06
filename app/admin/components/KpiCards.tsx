"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BusFront, Users, GraduationCap, TrendingUp, TrendingDown } from "lucide-react";

interface Kpis { activeBuses: number; activeDrivers: number; activeStudents: number; monthNetProfit: number | null; }

export default function KpiCards() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    async function load() {
      const [{ count: buses }, { count: drivers }, { count: students }, { data: plRows }] = await Promise.all([
        supabase.from("buses").select("*", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("drivers").select("*", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "Active"),
        supabase.from("v_fleet_monthly_pl").select("month, total_net_profit").order("month", { ascending: false }).limit(1),
      ]);
      setKpis({
        activeBuses: buses ?? 0, activeDrivers: drivers ?? 0, activeStudents: students ?? 0,
        monthNetProfit: plRows && plRows.length > 0 ? plRows[0].total_net_profit : null,
      });
    }
    load();
  }, []);

  if (!kpis) return null;
  const isProfit = kpis.monthNetProfit !== null && kpis.monthNetProfit >= 0;

  const cards = [
    { label: "حافلات نشطة", value: kpis.activeBuses, icon: BusFront, color: "var(--navy)" },
    { label: "سائقين نشطين", value: kpis.activeDrivers, icon: Users, color: "var(--navy)" },
    { label: "طلاب نشطين", value: kpis.activeStudents, icon: GraduationCap, color: "var(--navy)" },
    { label: "صافي الربح (آخر شهر)", value: kpis.monthNetProfit === null ? "—" : kpis.monthNetProfit, icon: isProfit ? TrendingUp : TrendingDown, color: kpis.monthNetProfit === null ? "var(--navy)" : isProfit ? "var(--green)" : "var(--red)" },
  ];

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
      {cards.map((c) => (
        <div key={c.label} className="card card-interactive" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--steel)", fontWeight: 600 }}>{c.label}</p>
            <c.icon size={18} color={c.color} />
          </div>
          <p style={{ margin: 0, fontSize: "1.7rem", fontWeight: 800, color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
