"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download } from "lucide-react";

interface Props {
  slug: string;
  fleetName: string;
  path?: string; // e.g. "/phone-login" (default) or "/register"
  title?: string;
  description?: string;
}

// A private link of one fleet (phone login, or self-registration), with a QR code drawn in the
// browser (the link is never sent to a third-party QR service). Both reuse the same random slug.
export default function FleetLoginLink({ slug, fleetName, path = "/phone-login", title, description }: Props) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = `${window.location.origin}${path}?f=${slug}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 480, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [slug, path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the link is still selectable below */ }
  }

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: 14 }}>
      <h2 style={{ fontSize: "1rem", color: "var(--navy)", margin: "0 0 4px" }}>{title ?? "رابط دخول السائقين وأولياء الأمور بالهاتف"}</h2>
      <p style={{ fontSize: "0.82rem", color: "var(--steel)", margin: "0 0 12px" }}>
        {description ?? "وزّع هذا الرابط أو رمز QR الخاص بأسطولك فقط. لا يعمل الدخول بالرقم إلا من خلاله."}
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {qr && <img src={qr} alt={`رمز QR لرابط دخول ${fleetName}`} width={160} height={160} style={{ borderRadius: 8, border: "1px solid var(--fog-dark)", background: "white" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input readOnly dir="ltr" value={url} className="input" style={{ fontSize: "0.8rem", marginBottom: 10 }} onFocus={(e) => e.target.select()} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copy} className="btn btn-secondary" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
              {copied ? <><Check size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ الرابط</>}
            </button>
            {qr && (
              <a href={qr} download={`${path.slice(1)}-qr-${slug}.png`} className="btn btn-secondary" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                <Download size={14} /> تنزيل الرمز
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
