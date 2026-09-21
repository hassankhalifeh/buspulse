"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAppUser } from "@/lib/useAppUser";
import { useFleetInfo } from "@/lib/useFleetInfo";
import FleetInfoForm from "../components/FleetInfoForm";

// Fleet settings: the owner/admin edits the information that identifies their own fleet.
export default function FleetSettingsPage() {
  const { appUser, loading } = useAppUser();
  const { fleet, loading: fleetLoading, reload } = useFleetInfo(appUser);

  if (loading || fleetLoading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;

  if (!appUser || (appUser.role !== "owner" && appUser.role !== "admin") || !fleet) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "var(--steel)" }}>هذه الصفحة لإدارة الأسطول فقط.</p>
        <Link href="/admin">العودة</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "1.75rem 1rem" }}>
      <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
        <ArrowRight size={15} /> العودة إلى لوحة الإدارة
      </Link>
      <div className="card" style={{ padding: "1.75rem" }}>
        <h1 style={{ fontSize: "1.25rem", color: "var(--navy)", margin: "0 0 4px" }}>إعدادات الأسطول</h1>
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", margin: 0 }}>معلومات أسطولك كما تظهر في النظام.</p>
        <FleetInfoForm fleet={fleet} submitLabel="حفظ التعديلات" onSaved={reload} />
      </div>
    </main>
  );
}
