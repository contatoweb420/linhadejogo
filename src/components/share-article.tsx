"use client";

import { useState } from "react";

export function ShareArticle({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  function share(kind: "whatsapp" | "email" | "copy") {
    const url = window.location.href;
    const text = `${title} ${url}`;
    if (kind === "copy") {
      setCopied(false);
      setCopyFailed(false);
      if (!navigator.clipboard?.writeText) {
        setCopyFailed(true);
        return;
      }
      void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setCopyFailed(true));
      return;
    }
    const href = kind === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(text)}` : `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn" onClick={() => share("copy")} aria-live="polite">
        {copied ? "Ligação copiada" : copyFailed ? "Não foi possível copiar" : "Copiar ligação"}
      </button>
      <button type="button" className="min-h-11 border border-line px-3 text-sm hover:bg-raised" onClick={() => share("whatsapp")}>
        WhatsApp
      </button>
      <button type="button" className="min-h-11 border border-line px-3 text-sm hover:bg-raised" onClick={() => share("email")}>
        E-mail
      </button>
    </div>
  );
}
