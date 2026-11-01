"use client";

import { usePathname, useRouter } from "next/navigation";
import { localePrefix, type Locale } from "@/lib/i18n";

const choices: { locale: Locale; flag: string; label: string }[] = [
  { locale: "pt-BR", flag: "🇧🇷", label: "Brasil" },
  { locale: "pt-PT", flag: "🇵🇹", label: "Portugal" },
  { locale: "en-US", flag: "🇺🇸", label: "United States" },
];

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const route = pathname.replace(/^\/(pt-br|pt-pt|en-us)(?=\/|$)/i, "") || "/";

  function change(next: Locale) {
    if (next === locale) return;
    router.push(`${localePrefix(next)}${route === "/" ? "" : route}`);
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-1 rounded-full border border-line bg-card/90 p-1" aria-label="Idioma / Language">
      {choices.map((choice) => (
        <button
          key={choice.locale}
          type="button"
          onClick={() => change(choice.locale)}
          aria-label={`${choice.flag} ${choice.label}`}
          aria-pressed={locale === choice.locale}
          title={choice.label}
          className={`grid h-9 min-w-9 place-items-center rounded-full px-1.5 text-lg transition-colors ${locale === choice.locale ? "bg-raised ring-1 ring-accent" : "opacity-70 hover:bg-raised hover:opacity-100"}`}
        >
          <span aria-hidden="true">{choice.flag}</span>
        </button>
      ))}
    </nav>
  );
}
