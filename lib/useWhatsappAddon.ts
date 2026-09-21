"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { AppUser } from "./types";

// Is the optional WhatsApp add-on switched on (and not expired) for the signed-in user's fleet?
// undefined = still loading. Failing to read it simply means "not active" — it never blocks the app.
export function useWhatsappAddon(appUser: AppUser | null) {
  const [active, setActive] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!appUser?.tenant_id) return;
    supabase
      .from("tenants")
      .select("whatsapp_module_enabled, whatsapp_module_expires_at")
      .eq("id", appUser.tenant_id)
      .maybeSingle()
      .then(({ data }) => {
        const notExpired = !data?.whatsapp_module_expires_at || new Date(data.whatsapp_module_expires_at) > new Date();
        setActive(!!data?.whatsapp_module_enabled && notExpired);
      });
  }, [appUser?.tenant_id]);

  return active;
}
