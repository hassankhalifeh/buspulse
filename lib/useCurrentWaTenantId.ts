"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// The WhatsApp bot sections in the admin dashboard need to know
// which wa_tenants row belongs to this fleet — null means the fleet
// hasn't activated/linked the WhatsApp module yet (whatsapp_module_enabled
// on Buspulse's own tenants row, plus a wa_tenants row with
// linked_fleet_id set — see buspulse-whatsapp/02_integration_adapter.sql).
export function useCurrentWaTenantId(fleetId: string | null) {
  const [waTenantId, setWaTenantId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!fleetId) return;
    supabase
      .from("wa_tenants")
      .select("id")
      .eq("linked_fleet_id", fleetId)
      .eq("mode", "integrated")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Likely the WhatsApp module SQL files haven't been run on
          // this project yet — fail to "not linked" rather than crash.
          console.warn("Could not load wa_tenants row (has the WhatsApp module been installed?):", error.message);
          setWaTenantId(null);
          return;
        }
        setWaTenantId(data?.id ?? null);
      });
  }, [fleetId]);

  return waTenantId; // undefined = still loading, null = not linked, string = the id
}
