import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Icon, type IconName } from "@/components/sport-icon";
import { localePrefix, translate, type Locale } from "@/lib/i18n";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/jogos", label: "Jogos", icon: "calendar" },
  { href: "/competicoes", label: "Competições", icon: "trophy" },
  { href: "/analise", label: "Análises", icon: "chart" },
  { href: "/noticias", label: "Notícias", icon: "feed" },
  { href: "/blog", label: "Blog", icon: "news" },
];

export function SiteHeader({ locale, pathname }: { locale: Locale; pathname: string }) {
  const prefix = localePrefix(locale);
  const t = (text: string) => translate(locale, text);
  return (
    <header className="site-header chrome">
      <div className="site-header__inner">
        <Link href={prefix} className="brand-lockup site-header__brand" aria-label="Linha de Jogo">
          <BrandMark />
        </Link>
        <nav className="desktop-nav" aria-label={locale === "en-US" ? "Main navigation" : "Navegação principal"}>
          {links.map(link => {
            const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={`${prefix}${link.href === "/" ? "" : link.href}`} aria-current={active ? "page" : undefined}>
                <Icon name={link.icon} /><span>{t(link.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="site-header__tools">
          <Link href={`${prefix}/pesquisa`} className="header-search" aria-label={t("Pesquisar")}><Icon name="teams" /></Link>
          <LocaleSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
