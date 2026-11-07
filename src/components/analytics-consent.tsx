"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useState } from "react";
import { consentKey, measurementId, updateAnalyticsConsent } from "@/lib/analytics";
import { localePrefix, type Locale } from "@/lib/i18n";

type Choice = "granted" | "denied" | null;

export function AnalyticsConsent({ locale }: { locale: Locale }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadTag, setLoadTag] = useState(false);
  const english = locale === "en-US";

  useEffect(() => {
    function restore() {
      let saved: Choice = null;
      try {
        const value = localStorage.getItem(consentKey);
        if (value === "granted" || value === "denied") saved = value;
      } catch { /* Storage unavailable: keep the default denied state. */ }
      updateAnalyticsConsent(saved === "granted");
      setChoice(saved);
      if (saved === "granted") setLoadTag(true);
      setReady(true);
    }
    restore();
    window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, []);

  function choose(value: Exclude<Choice, null>) {
    updateAnalyticsConsent(value === "granted");
    try { localStorage.setItem(consentKey, value); } catch { /* Session-only choice. */ }
    setChoice(value);
    setOpen(false);
    if (value === "granted") setLoadTag(true);
  }

  return (
    <>
      {loadTag && <Script id="google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />}
      {ready && (choice === null || open) ? (
        <section aria-label={english ? "Analytics consent" : "Consentimento de analytics"} className="fixed inset-x-0 bottom-0 z-[100] border-t border-line bg-card p-4 text-sm text-foreground shadow-lg">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
            <p className="flex-1">{english ? "May we use Google Analytics cookies to understand how this site is used? You can refuse or change your choice at any time." : "Podemos usar cookies do Google Analytics para compreender a utilização do site? Pode recusar ou alterar a sua escolha a qualquer momento."} <Link className="text-primary underline" href={`${localePrefix(locale)}/privacidade`}>{english ? "Privacy" : "Privacidade"}</Link></p>
            <button type="button" className="rounded border border-line px-4 py-2" onClick={() => choose("denied")}>{english ? "Reject analytics" : "Recusar analytics"}</button>
            <button type="button" className="rounded border border-line px-4 py-2" onClick={() => choose("granted")}>{english ? "Accept analytics" : "Aceitar analytics"}</button>
          </div>
        </section>
      ) : ready ? (
        <button type="button" className="fixed bottom-2 right-2 z-50 rounded border border-line bg-card px-3 py-2 text-xs text-muted" onClick={() => setOpen(true)}>{english ? "Cookie preferences" : "Preferências de cookies"}</button>
      ) : null}
    </>
  );
}
