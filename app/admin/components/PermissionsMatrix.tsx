"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, AlertTriangle } from "lucide-react";

interface AppUserRow { id: string; full_name: string; role: string; }
interface Capability { key: string; label_ar: string; category: string; }

// The literal "warn before granting a conflicting permission" screen —
// every checkbox writes straight to user_capabilities, and toggling
// one ON first asks the database (get_conflict_warnings, from
// buspulse-upgrade/04b) whether this creates a known conflict for
// this specific person, showing the warning before confirming.
export default function PermissionsMatrix({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
  const [pendingWarning, setPendingWarning] = useState<{ userId: string; capKey: string; messages: string[] } | null>(null);

  async function load() {
    const [{ data: userRows }, { data: capRows }] = await Promise.all([
      supabase.from("app_users").select("id, full_name, role").eq("tenant_id", tenantId),
      supabase.from("capabilities").select("*"),
    ]);
    setUsers(userRows ?? []);
    setCapabilities(capRows ?? []);

    if (userRows && userRows.length > 0) {
      const { data: grantRows } = await supabase
        .from("user_capabilities")
        .select("app_user_id, capability_key, granted")
        .in("app_user_id", userRows.map((u) => u.id));

      const map: Record<string, Set<string>> = {};
      (grantRows ?? []).forEach((g) => {
        if (!g.granted) return;
        if (!map[g.app_user_id]) map[g.app_user_id] = new Set();
        map[g.app_user_id].add(g.capability_key);
      });
      setGrants(map);
    }
  }

  useEffect(() => { load(); }, [tenantId]);

  async function applyGrant(userId: string, capKey: string) {
    await supabase.from("user_capabilities").upsert(
      { app_user_id: userId, capability_key: capKey, granted: true },
      { onConflict: "app_user_id,capability_key" }
    );
    setGrants((g) => {
      const next = { ...g, [userId]: new Set(g[userId] ?? []) };
      next[userId].add(capKey);
      return next;
    });
  }

  async function revoke(userId: string, capKey: string) {
    await supabase.from("user_capabilities").delete().eq("app_user_id", userId).eq("capability_key", capKey);
    setGrants((g) => {
      const next = { ...g, [userId]: new Set(g[userId] ?? []) };
      next[userId].delete(capKey);
      return next;
    });
  }

  async function toggle(userId: string, capKey: string, currentlyGranted: boolean) {
    if (currentlyGranted) {
      await revoke(userId, capKey);
      return;
    }
    const { data: warnings } = await supabase.rpc("get_conflict_warnings", { p_app_user_id: userId, p_new_capability: capKey });
    const messages = (warnings ?? []).map((w: any) => w.warning);
    if (messages.length > 0) {
      setPendingWarning({ userId, capKey, messages });
    } else {
      applyGrant(userId, capKey);
    }
  }

  if (users.length === 0) return <p style={{ color: "var(--steel)" }}>لا يوجد مستخدمون بعد.</p>;

  const categories = Array.from(new Set(capabilities.map((c) => c.category)));

  return (
    <div>
      <div className="card fade-in" style={{ overflowX: "auto", padding: "0.5rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              {categories.map((cat) =>
                capabilities.filter((c) => c.category === cat).map((c) => (
                  <th key={c.key} style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>{c.label_ar}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>
                  {u.full_name}<br /><span style={{ fontSize: "0.75rem", color: "var(--steel)" }}>{u.role}</span>
                </td>
                {capabilities.map((c) => {
                  const granted = grants[u.id]?.has(c.key) ?? false;
                  const isOwnerAdmin = u.role === "owner" || u.role === "admin";
                  return (
                    <td key={c.key} style={{ textAlign: "center" }}>
                      {isOwnerAdmin ? (
                        <span title="يملك كل الصلاحيات تلقائياً" style={{ color: "var(--steel-light)", fontSize: "0.75rem" }}>—</span>
                      ) : (
                        <button
                          onClick={() => toggle(u.id, c.key, granted)}
                          style={{ width: 26, height: 26, borderRadius: 7, border: "1.5px solid var(--fog-dark)", background: granted ? "var(--green)" : "white", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          title={c.label_ar}
                        >
                          {granted && <Check size={15} color="white" />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingWarning && (
        <div onClick={() => setPendingWarning(null)} className="fade-in" style={{ position: "fixed", inset: 0, background: "rgba(27,42,56,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: "1.5rem", width: 440, maxWidth: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={20} color="var(--red)" />
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--red)" }}>تنبيه من تعارض صلاحيات</h3>
            </div>
            {pendingWarning.messages.map((m, i) => (
              <p key={i} style={{ fontSize: "0.88rem", color: "#333", marginBottom: 8 }}>{m}</p>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => { applyGrant(pendingWarning.userId, pendingWarning.capKey); setPendingWarning(null); }}
                className="btn" style={{ background: "var(--red)", color: "white", flex: 1 }}
              >
                منح الصلاحية رغم التنبيه
              </button>
              <button onClick={() => setPendingWarning(null)} className="btn btn-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
