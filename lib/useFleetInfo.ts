"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { AppUser } from "./types";

export interface FleetInfo {
  fleet_id: string;
  company_name: string;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  registration_number: string | null;
  currency: string;
  timezone: string;
  working_hours: string | null;
  logo_url: string | null;
  notes: string | null;
  onboarding_completed: boolean;
  login_slug?: string;
}

// The signed-in owner/admin's own fleet (RLS only ever returns their fleet).
export function useFleetInfo(appUser: AppUser | null) {
  const [fleet, setFleet] = useState<FleetInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!appUser?.tenant_id) {
      setFleet(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from("fleets").select("*").eq("tenant_id", appUser.tenant_id).maybeSingle();
    if (error) console.error("Failed to load fleet:", error.message);
    setFleet((data as FleetInfo) ?? null);
    setLoading(false);
  }, [appUser?.tenant_id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { fleet, loading, reload };
}
