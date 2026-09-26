"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { AppUser } from "./types";

// Who the signed-in person is inside a fleet's admin panel, and what a staff member ("assistant") may open.
// Owners/admins can do everything; an assistant can do exactly what the owner ticked in the Permissions screen.
export function useStaffCaps(appUser: AppUser | null) {
  const isManager = appUser?.role === "owner" || appUser?.role === "admin";
  const isAssistant = appUser?.role === "assistant";
  const [caps, setCaps] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isAssistant || !appUser) { setCaps(null); return; }
    supabase.from("user_capabilities").select("capability_key").eq("app_user_id", appUser.id).eq("granted", true)
      .then(({ data }) => setCaps(new Set((data ?? []).map((r) => r.capability_key))));
  }, [isAssistant, appUser]);

  return {
    isManager,
    isAssistant,
    isStaff: isManager || isAssistant,
    ready: isManager || (isAssistant && caps !== null),
    can: (key?: string) => isManager || (!!key && !!caps?.has(key)),
  };
}
