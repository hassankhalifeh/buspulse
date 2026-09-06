"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AlertTriangle, Megaphone } from "lucide-react";

interface Announcement { announcement_id: string; title: string; content: string; announcement_type: "Circular" | "Emergency"; created_at: string; }

export default function AnnouncementsList({ busIds, contractIds }: { busIds: string[]; contractIds: string[] }) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (busIds.length === 0 && contractIds.length === 0) return;
    const targetIds = [...busIds, ...contractIds];
    supabase.from("announcements").select("announcement_id, title, content, announcement_type, created_at")
      .or(`target_audience.eq.All,target_id.in.(${targetIds.join(",")})`)
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setItems(data ?? []));
  }, [busIds, contractIds]);

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {items.map((a) => {
        const isEmergency = a.announcement_type === "Emergency";
        return (
          <div key={a.announcement_id} className="card" style={{ background: isEmergency ? "#fbeaea" : "white", borderInlineStart: `4px solid ${isEmergency ? "var(--red)" : "var(--fog-dark)"}`, padding: "12px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
            {isEmergency ? <AlertTriangle size={17} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} /> : <Megaphone size={17} color="var(--steel)" style={{ flexShrink: 0, marginTop: 2 }} />}
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>{a.title}</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--steel)" }}>{a.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
