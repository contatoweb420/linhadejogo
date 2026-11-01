import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header className="chrome sticky top-0 z-30 border-b border-line">
      <div className="flex w-full items-center justify-between px-4 py-2 md:px-6">
        <Link href="/" className="brand-lockup md:hidden" aria-label="Linha de Jogo">
          <BrandMark />
        </Link>
        <div className="ml-auto"><LocaleSwitcher locale={locale} /></div>
      </div>
    </header>
  );
}
