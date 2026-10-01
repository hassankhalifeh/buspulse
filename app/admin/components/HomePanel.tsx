"use client";

import type { AppUser } from "@/lib/types";

const ROLE_AR: Record<string, string> = { owner: "صاحب الأسطول", admin: "مدير", assistant: "موظف" };

interface NavEntry { id: string; label: string; icon: any }

interface Props {
  appUser: AppUser;
  sections: NavEntry[]; // every section this user can open, except "home" itself
  onNavigate: (id: string) => void;
}

// الصفحة الرئيسية: أول ما يراه المستخدم عند الدخول، ما لم يكن قد اختار صفحة أخرى كرئيسية له (بالنجمة).
// لا تعرض بيانات حساسة بنفسها — فقط ترحيب واختصارات لما يملك المستخدم صلاحية فتحه فعلاً.
export default function HomePanel({ appUser, sections, onNavigate }: Props) {
  return (
    <div className="fade-in">
      <div className="card" style={{ padding: "1.5rem", marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.15rem", color: "var(--navy)" }}>أهلاً {appUser.full_name}</h2>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--steel)" }}>
          {ROLE_AR[appUser.role] ?? appUser.role} — اضغط النجمة ★ بجانب عنوان أي صفحة لجعلها صفحتك الرئيسية بدل هذه.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className="card card-interactive"
            style={{ padding: "1.1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "none", cursor: "pointer", background: "white" }}
          >
            <s.icon size={22} color="var(--navy)" />
            <span style={{ fontSize: "0.88rem", color: "var(--navy)", fontWeight: 600, textAlign: "center" }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
