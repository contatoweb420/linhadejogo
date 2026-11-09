import Link from "@/components/localized-link";
import { Icon, type IconName } from "@/components/sport-icon";
import { localePrefix, translate, type Locale } from "@/lib/i18n";
const items: {
  href: string;
  label: string;
  icon: IconName;
}[] = [{
  href: "/",
  label: "Visão geral",
  icon: "home"
}, {
  href: "/jogos",
  label: "Jogos",
  icon: "calendar"
}, {
  href: "/competicoes",
  label: "Competições",
  icon: "trophy"
}, {
  href: "/pesquisa",
  label: "Equipas",
  icon: "teams"
}, {
  href: "/avaliacao",
  label: "Estatísticas",
  icon: "bars"
}, {
  href: "/analise",
  label: "Análise de jogos",
  icon: "chart"
}, {
  href: "/noticias",
  label: "Notícias",
  icon: "feed"
}, {
  href: "/blog",
  label: "Blog",
  icon: "news"
}];
export function HomeSidebar({
  locale
}: {
  locale: Locale;
}) {
  const prefix = localePrefix(locale);
  const t = (text: string) => translate(locale, text);
  return <aside className="home-sidebar">
      <nav className="premium-panel home-menu" aria-label={t("Acesso rápido")}>
        <p className="panel-kicker">{locale === "en-US" ? "EXPLORE" : "EXPLORAR"}</p>
        {items.map(item => <Link href={`${prefix}${item.href === "/" ? "" : item.href}`} key={item.href} aria-current={item.href === "/" ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span>{item.href === "/" ? <span className="nav-active-dot" aria-hidden="true" /> : null}</Link>)}
        <Link href={`${prefix}/sobre`} className="home-menu__about"><Icon name="info" />{t("Sobre")}</Link>
      </nav>
      <div className="insight-promo">
        <Icon name="chart" /><p className="eyebrow">FOOTBALL INTELLIGENCE</p>
        <h2>{locale === "en-US" ? "More context. A better perspective." : "Mais contexto. Outra visão."}</h2>
        <p>{locale === "en-US" ? "Form, head-to-head and probabilities. Explore the numbers behind each game." : locale === "pt-BR" ? "Forma, confrontos e probabilidades. Explore os números de cada partida." : "Forma, confrontos e probabilidades. Explora os números de cada jogo."}</p>
        <Link href={`${prefix}/analise`}>{t("Análises")}<span aria-hidden="true">↗</span></Link>
      </div>
    </aside>;
}
