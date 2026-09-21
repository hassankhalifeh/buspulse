"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// QR drawn in the browser: the encoded text (which can contain a personal login token)
// is never sent to a third-party QR service.
export default function LocalQr({ text, size = 220 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => { if (!cancelled) setSrc(d); })
      .catch(() => { if (!cancelled) setSrc(""); });
    return () => { cancelled = true; };
  }, [text, size]);

  if (!src) return <div style={{ width: size, height: size, margin: "0 auto 12px" }} />;
  return <img src={src} alt="QR" width={size} height={size} style={{ marginBottom: 12, background: "white" }} />;
}
