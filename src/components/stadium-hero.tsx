import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/sport-icon";
import { localePrefix, type Locale } from "@/lib/i18n";
import stadium from "../../public/marca/estadio-panorama.webp";
export function StadiumHero({
  locale
}: {
  locale: Locale;
}) {
  const prefix = localePrefix(locale);
  const english = locale === "en-US";
  const brazil = locale === "pt-BR";
  return <><div className="home-stadium-backdrop" aria-hidden="true">
      <Image src={stadium} alt="" fill preload sizes="100vw" className="home-stadium-backdrop__image" />
      </div><section className="stadium-hero" aria-labelledby="hero-title">
      <div className="stadium-hero__content">
        <p className="eyebrow"><span className="signal-dot" />{english ? "THE GAME. THE NUMBERS. THE INSIGHT." : "O JOGO. OS NÚMEROS. A VISÃO."}</p>
        <h2 id="hero-title">{english ? "Football goes" : "O futebol vai"}<br /><span>{english ? "beyond the score." : "além do resultado."}</span></h2>
        <p className="stadium-hero__description">{english ? "Follow the games. Explore the statistics. Discover a new perspective on every match." : brazil ? "Acompanhe os jogos. Explore as estatísticas. Descubra uma nova perspectiva sobre cada partida." : "Acompanha os jogos. Explora as estatísticas. Descobre uma nova perspetiva sobre cada partida."}</p>
        <div className="stadium-hero__actions">
          <Link href={`${prefix}/jogos`} className="btn">{english ? "Explore games" : "Explorar jogos"}<span aria-hidden="true">↗</span></Link>
          <Link href={`${prefix}/competicoes`} className="hero-secondary">{english ? "Explore leagues" : "Explorar competições"}<span aria-hidden="true">→</span></Link>
        </div>
      </div>
      <div className="stadium-hero__bottom"><span><Icon name="chart" />{english ? "Data-driven analysis" : "Análise baseada em dados"}</span><span>{english ? "FORM / HEAD-TO-HEAD / PROBABILITIES" : "FORMA / CONFRONTOS / PROBABILIDADES"}</span></div>
    </section></>;
}
