"use client";

import { useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  title: string;
  description?: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<string | null>; // returns an error message, or null on success
  onRemove?: () => Promise<string | null>;
}

// واجهة رفع/إزالة صورة خلفية واحدة — تُستخدم لخلفية الأسطول ولخلفية المنصة الافتراضية على حدٍّ سواء،
// والفرق بينهما (مسار التخزين والجدول المحفوظ فيه) يُحسم في مكان الاستدعاء عبر onUpload/onRemove.
export default function BackgroundPicker({ title, description, currentUrl, onUpload, onRemove }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) return setError("الصيغ المقبولة: JPG أو PNG أو WEBP فقط.");
    if (file.size > MAX_SIZE) return setError("الحجم الأقصى 5 ميجابايت.");
    setBusy(true);
    const err = await onUpload(file);
    setBusy(false);
    if (err) setError(err);
  }

  async function handleRemove() {
    if (!onRemove) return;
    setBusy(true);
    const err = await onRemove();
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "1rem", color: "var(--navy)" }}>{title}</h3>
      {description && <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--steel)" }}>{description}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{
          width: 110, height: 70, borderRadius: 8, overflow: "hidden", flexShrink: 0,
          background: currentUrl ? `url(${currentUrl}) center/cover` : "var(--fog)",
          border: "1.5px solid var(--fog-dark)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {!currentUrl && <ImageIcon size={20} color="var(--steel-light)" />}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="btn btn-secondary" style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "جارٍ الرفع..." : currentUrl ? "تغيير الصورة" : "رفع صورة"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={busy} style={{ display: "none" }} />
          </label>
          {currentUrl && onRemove && (
            <button type="button" onClick={handleRemove} disabled={busy} className="btn" style={{ border: "1.5px solid var(--fog-dark)", background: "white", color: "var(--red)" }}>
              <Trash2 size={15} /> إزالة
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
