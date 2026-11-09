import Link from "@/components/localized-link";
import { getSocialProfileLinks } from "@/lib/social-links";
import { localePrefix, translate, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  const socialLinks = getSocialProfileLinks();
  return (
    <footer className="site-footer border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted md:flex-row md:justify-between">
        <p className="max-w-xl">
          {locale === "en-US"
            ? "Analysis is for informational purposes. Sports outcomes are uncertain, and predictions do not guarantee results or financial returns."
            : locale === "pt-BR"
              ? "As análises são informativas. Os resultados esportivos são incertos e as previsões não garantem resultados nem retorno financeiro."
              : "As análises são informativas. Os resultados desportivos são incertos e as previsões não garantem resultados nem retorno financeiro."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {socialLinks.map(({ label, href, icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-primary hover:text-primary-hover">
              <SocialIcon name={icon} />
            </a>
          ))}
          <Link href={`${localePrefix(locale)}/privacidade`} className="text-primary underline-offset-4 hover:text-primary-hover hover:underline">
            {t("Privacidade")}
          </Link>
          <Link href={`${localePrefix(locale)}/condicoes`} className="text-primary underline-offset-4 hover:text-primary-hover hover:underline">
            {t("Condições")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: "instagram" | "tiktok" }) {
  return name === "instagram" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.6 7.5a5.4 5.4 0 0 1-3.5-1.3v7.1a5.7 5.7 0 1 1-5.7-5.7c.4 0 .8 0 1.2.1v3.2a2.6 2.6 0 1 0 1.4 2.3V2.5h3.1a5.4 5.4 0 0 0 3.5 3.2z" />
    </svg>
  );
}
