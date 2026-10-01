"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// The admin panel's background image for a given fleet: the fleet's own custom one if it set one,
// otherwise whatever the platform admin configured as the global default.
export function useFleetBackground(fleetId: string | null) {
  const [ownUrl, setOwnUrl] = useState<string | null>(null); // this fleet's own override, if any
  const [defaultUrl, setDefaultUrl] = useState<string | null>(null); // the platform-wide default
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ data: platform }, appearance] = await Promise.all([
      supabase.from("platform_settings").select("default_background_image_url").eq("id", true).maybeSingle(),
      fleetId
        ? supabase.from("fleet_appearance").select("background_image_url").eq("fleet_id", fleetId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setDefaultUrl(platform?.default_background_image_url ?? null);
    setOwnUrl(appearance.data?.background_image_url ?? null);
    setLoading(false);
  }, [fleetId]);

  useEffect(() => { reload(); }, [reload]);

  return { ownUrl, defaultUrl, effectiveUrl: ownUrl ?? defaultUrl, loading, reload };
}
