"use client";

import type { Bus } from "@/lib/types";
import { BusFront, ChevronLeft } from "lucide-react";

export default function BusPicker({ buses, onSelect }: { buses: Bus[]; onSelect: (bus: Bus) => void }) {
  return (
    <div className="fade-in" style={{ maxWidth: 480, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h2 style={{ fontSize: "1.3rem", color: "var(--navy)", marginBottom: 4, fontWeight: 800 }}>اختر الحافلة</h2>
      <p style={{ fontSize: "0.9rem", color: "var(--steel)", marginBottom: 18 }}>
        أنت مسؤول عن أكثر من حافلة — اختر الحافلة التي تعمل عليها الآن.
      </p>
      {buses.map((b) => (
        <button
          key={b.bus_id}
          onClick={() => onSelect(b)}
          className="card card-interactive"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "right", border: "1.5px solid var(--fog-dark)", padding: "16px 18px", marginBottom: 10, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--fog)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BusFront size={20} color="var(--navy)" />
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="id-code" style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--navy)" }}>{b.plate_number}</span>
              {b.model && <p style={{ margin: 0, color: "var(--steel)", fontSize: "0.85rem" }}>{b.model}</p>}
            </div>
          </div>
          <ChevronLeft size={18} color="var(--steel-light)" />
        </button>
      ))}
    </div>
  );
}
