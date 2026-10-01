"use client";

import FleetLoginLink from "../components/FleetLoginLink";
import BackgroundPicker from "../components/BackgroundPicker";
import LogoutButton from "@/app/components/LogoutButton";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAppUser } from "@/lib/useAppUser";
import { useFleetInfo } from "@/lib/useFleetInfo";
import { useFleetBackground } from "@/lib/useFleetBackground";
import { useStaffCaps } from "@/lib/useStaffCaps";
import { supabase } from "@/lib/supabaseClient";
import FleetInfoForm from "../components/FleetInfoForm";

// Fleet settings: the owner/admin edits the information that identifies their own fleet. A staff member
// ("assistant") only ever sees the background-image card below, and only when the owner has allowed it
// (fleet.background_locked_for_staff) — everything else here stays owner/admin only.
export default function FleetSettingsPage() {
  const { appUser, loading } = useAppUser();
  const { fleet, loading: fleetLoading, reload } = useFleetInfo(appUser);
  const access = useStaffCaps(appUser);
  const { ownUrl: backgroundUrl, reload: reloadBackground } = useFleetBackground(fleet?.fleet_id ?? null);

  if (loading || fleetLoading) return <p style={{ padding: 24, color: "var(--steel)" }}>جارٍ التحميل...</p>;

  if (!appUser || !access.isStaff || !fleet) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "var(--steel)" }}>هذه الصفحة لإدارة الأسطول فقط.</p>
        <Link href="/admin">العودة</Link>
      </main>
    );
  }

  async function uploadBackground(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `fleet/${fleet!.fleet_id}/background.${ext}`;
    const { error: upErr } = await supabase.storage.from("backgrounds").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) return "تعذّر رفع الصورة: " + upErr.message;
    const { data } = supabase.storage.from("backgrounds").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`; // نفس المسار يُستبدل في كل رفعة، فنضيف رقماً يمنع التخزين المؤقت من إظهار الصورة القديمة
    const { error: dbErr } = await supabase.from("fleet_appearance").upsert({ fleet_id: fleet!.fleet_id, background_image_url: url });
    if (dbErr) return dbErr.message;
    await reloadBackground();
    return null;
  }

  async function removeBackground(): Promise<string | null> {
    const { error } = await supabase.from("fleet_appearance").upsert({ fleet_id: fleet!.fleet_id, background_image_url: null });
    if (error) return error.message;
    await reloadBackground();
    return null;
  }

  async function toggleStaffCanEdit(allow: boolean) {
    await supabase.from("fleets").update({ background_locked_for_staff: !allow }).eq("fleet_id", fleet!.fleet_id);
    reload();
  }

  // موظف لا يملك إذن تعديل الخلفية: لا يرى شيئاً في هذه الصفحة أصلاً
  if (access.isAssistant && fleet.background_locked_for_staff) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "1.75rem 1rem" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
          <ArrowRight size={15} /> العودة إلى لوحة الإدارة
        </Link>
        <p style={{ color: "var(--steel)" }}>ليست لديك صلاحية لتعديل أي شيء في هذه الصفحة.</p>
      </main>
    );
  }

  if (access.isAssistant) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "1.75rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><LogoutButton redirectTo="/admin" /></div>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
          <ArrowRight size={15} /> العودة إلى لوحة الإدارة
        </Link>
        <BackgroundPicker
          title="خلفية لوحة الإدارة"
          description="صورة خلفية تظهر خلف محتوى لوحة الإدارة لكل من يستخدم هذا الأسطول."
          currentUrl={backgroundUrl}
          onUpload={uploadBackground}
          onRemove={removeBackground}
        />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "1.75rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><LogoutButton redirectTo="/admin" /></div>
      <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--steel)", fontSize: "0.88rem", marginBottom: 14 }}>
        <ArrowRight size={15} /> العودة إلى لوحة الإدارة
      </Link>
      {fleet?.login_slug && <FleetLoginLink slug={fleet.login_slug} fleetName={fleet.company_name} />}
      {fleet?.login_slug && (
        <FleetLoginLink
          slug={fleet.login_slug}
          fleetName={fleet.company_name}
          path="/register"
          title="رابط تسجيل ولي أمر جديد"
          description="وزّع هذا الرابط ليطلب أولياء الأمور الجدد تسجيل حسابهم بأنفسهم. تراجع أنت كل طلب من قسم «طلبات التسجيل» قبل الموافقة."
        />
      )}
      <div className="card" style={{ padding: "1.75rem", marginBottom: 14 }}>
        <h1 style={{ fontSize: "1.25rem", color: "var(--navy)", margin: "0 0 4px" }}>إعدادات الأسطول</h1>
        <p style={{ fontSize: "0.88rem", color: "var(--steel)", margin: 0 }}>معلومات أسطولك كما تظهر في النظام.</p>
        <FleetInfoForm fleet={fleet} submitLabel="حفظ التعديلات" onSaved={reload} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <BackgroundPicker
          title="خلفية لوحة الإدارة"
          description="تحل محل الخلفية الافتراضية للمنصة، لهذا الأسطول فقط. إن لم تضع صورة، تظهر خلفية المنصة الافتراضية."
          currentUrl={backgroundUrl}
          onUpload={uploadBackground}
          onRemove={removeBackground}
        />
      </div>

      <div className="card" style={{ padding: "1.25rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={!fleet.background_locked_for_staff} onChange={(e) => toggleStaffCanEdit(e.target.checked)} />
          <span style={{ fontSize: "0.9rem" }}>السماح للموظفين (غير المدير/صاحب الأسطول) بتغيير خلفية لوحة الإدارة</span>
        </label>
      </div>
    </main>
  );
}
