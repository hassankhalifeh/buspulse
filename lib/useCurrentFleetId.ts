"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { AppUser } from "./types";

export function useCurrentFleetId(appUser: AppUser | null) {
  const [fleetId, setFleetId] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser?.tenant_id) return;
    supabase
      .from("fleets")
      .select("fleet_id")
      .eq("tenant_id", appUser.tenant_id)
      .maybeSingle()
      .then(({ data }) => setFleetId(data?.fleet_id ?? null));
  }, [appUser]);

  return fleetId;
}
