"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { AppUser } from "./types";

export function useAppUser() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUid = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      currentUid.current = user?.id ?? null;

      if (!user) {
        if (isMounted) {
          setAppUser(null);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("auth_uid", user.id)
        .single();

      if (isMounted) {
        if (error) console.error("Failed to load app_users row:", error.message);
        setAppUser(data ?? null);
        setLoading(false);
      }
    }

    load();

    // Re-read the profile when someone signs in or out without a page reload (the login form relies on this).
    // Token refreshes and tab-focus events keep the same user, so they are ignored.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid !== currentUid.current) {
        setLoading(true);
        load();
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { appUser, loading };
}
