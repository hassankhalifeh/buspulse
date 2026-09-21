"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  variant?: "nav" | "light" | "plain";
  redirectTo?: string;
}

export default function LogoutButton({ variant = "plain", redirectTo = "/" }: Props) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await supabase.auth.signOut();
    // full reload so no hook keeps the previous user's data in memory
    window.location.href = redirectTo;
  }

  const content = <><LogOut size={variant === "nav" ? 17 : 14} />{busy ? "..." : "تسجيل الخروج"}</>;

  if (variant === "nav") {
    return <button onClick={logout} disabled={busy} className="nav-item" style={{ marginTop: 18 }}>{content}</button>;
  }
  if (variant === "light") {
    return (
      <button onClick={logout} disabled={busy} className="btn" style={{ background: "rgba(255,255,255,0.08)", color: "white", padding: "8px 14px", fontSize: "0.85rem" }}>
        {content}
      </button>
    );
  }
  return <button onClick={logout} disabled={busy} className="btn btn-secondary" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>{content}</button>;
}
