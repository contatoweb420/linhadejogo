import { ProbabilityTiles } from "@/components/probability-tiles";
import { estimatesForMatches } from "@/server/estimates";
import Link from "@/components/localized-link";
import { Suspense } from "react";
import { CountUp, Reveal } from "@/components/chart-motion";
import { CompetitionLink } from "@/components/competition-link";
import { Cover } from "@/components/cover";
import { EditorialImage } from "@/components/editorial-image";
import { Crest } from "@/components/crest";
import { SetupPanel } from "@/components/setup-panel";
import { publicArticles } from "@/server/blog-agent/public";
import { pingDatabase } from "@/server/db/client";
import { formatCountry, formatLisbonTime, formatStatus, lisbonToday, matchGroup } from "@/server/format/pt";
import { readNews } from "@/server/news/store";
import { homeStandings, homeDaySummary, listCompetitions, listHomeMatches } from "@/server/queries";
import { localePrefix, type Locale } from "@/lib/i18n";
import { homeText, homeDateTime, homeResultDetails } from "@/lib/home-presentation";
import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: homeText(locale, "Visão geral"),
    description: locale === "en-US" ? "Football results, fixtures, standings and statistical previews from Linha de Jogo." : locale === "pt-BR" ? "Resultados, partidas, classificações e previsões estatísticas da Linha de Jogo." : "Resultados, jogos, classificações e estimativas estatísticas da Linha de Jogo.",
  };
}

type DayMatch = Awaited<ReturnType<typeof listHomeMatches>>[number];

export default async function HomePage() {
  const locale = await getLocale();
  const t = (text: string) => homeText(locale, text);
  const today = lisbonToday();
  const database = await pingDatabase();
  if (!database) return <div data-home-ready><SetupPanel database={database} /></div>;

  const now = new Date();
  const [finished, live, upcoming, summary, catalog] = await Promise.all([
    listHomeMatches("finished", now),
    listHomeMatches("live", now),
    listHomeMatches("upcoming", now),
    homeDaySummary(today),
    listCompetitions(),
  ]);
  const lead = live[0] ?? upcoming[0] ?? finished[0] ?? null;
  const featuredCompetitions = [...catalog].sort((a, b) => rankCompetition(a.code) - rankCompetition(b.code)).slice(0, 8);

  return (
    <div className="home-page" data-home-ready>
      <nav className="sport-strip" aria-label={t("Acesso rápido")}>
        <Link href={homeHref("/jogos", locale)} className="sport-strip__active"><span aria-hidden="true">⚽</span>{t("Jogos")}</Link>
        <Link href={homeHref("/competicoes", locale)}>{t("Competições")}</Link>
        <Link href={homeHref("/avaliacao", locale)}>{t("Estatísticas")}</Link>
        <span className="sport-strip__note">{locale === "en-US" ? "The game, in perspective" : locale === "pt-BR" ? "Uma nova perspectiva do jogo" : "Uma nova perspetiva do jogo"}</span>
      </nav>
      <div className="home-dashboard">
        <div className="home-center">
          <section className="premium-panel daily-board" aria-labelledby="daily-title">
            <div className="panel-heading">
              <div><p className="panel-kicker">{locale === "en-US" ? "MATCH CENTER" : "CENTRO DE JOGO"}</p><h1 id="daily-title">{locale === "en-US" ? "Games & results" : locale === "pt-BR" ? "Partidas e resultados" : "Jogos e resultados"}</h1></div>
              <Link href={homeHref("/jogos", locale)} className="panel-action">{t("Ver o quadro")} ↗</Link>
            </div>
            <p className="board-date">{new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(new Date(`${today}T12:00:00Z`))}</p>
            <div className="daily-counters" aria-label={t("Jogos de hoje")}>
              <Count label={t("Em direto")} value={summary.live} href={homeHref("/jogos", locale)} />
              <Count label={t("Por disputar")} value={summary.upcoming} href={homeHref("/jogos", locale)} />
              <Count label={t("Terminados")} value={summary.finished} href={homeHref("/jogos", locale)} />
            </div>
            <p className="data-notice board-context">{locale === "en-US" ? "Today's summary. Lists include saved recent results and upcoming dates; updates run independently." : locale === "pt-BR" ? "Resumo de hoje. As listas incluem resultados recentes e próximas datas salvos; a atualização é independente." : "Resumo de hoje. As listas incluem resultados recentes e próximas datas guardados; a atualização é independente."}</p>
            <MatchSection title={t("Em direto")} action={t("Ver o quadro")} empty={locale === "en-US" ? "No games saved as live today." : locale === "pt-BR" ? "Nenhuma partida salva como ao vivo hoje." : "Não há jogos guardados como em direto hoje."} matches={live} locale={locale} />
            <MatchSection title={locale === "en-US" ? "Upcoming games" : "Próximos jogos"} action={t("Ver o quadro")} empty={locale === "en-US" ? "No upcoming games saved." : locale === "pt-BR" ? "Nenhuma próxima partida salva." : "Não há próximos jogos guardados."} matches={upcoming} locale={locale} />
            <MatchSection title={locale === "en-US" ? "Recent results" : "Resultados recentes"} action={t("Ver o quadro")} empty={locale === "en-US" ? "No saved results available." : locale === "pt-BR" ? "Nenhum resultado salvo disponível." : "Não há resultados guardados disponíveis."} matches={finished} locale={locale} />
            <div className="board-footnote"><span className="signal-dot" /><p>{t("Os estados apresentados são os guardados, incluindo jogos de datas anteriores ainda marcados como em direto.")}</p></div>
            <Link href={homeHref("/jogos", locale)} className="board-all-link">{t("Ver jogos, incluindo adiados e cancelados")} ↗</Link>
          </section>
          <Suspense fallback={<p className="premium-panel p-5 text-muted">{t("Notícias")}…</p>}><HomeNews locale={locale} /></Suspense>
        </div>
        <aside className="home-right" aria-label={t("Análises")}>
          {lead ? <Lead match={lead} locale={locale} /> : <section className="premium-panel intelligence-card"><h2>{t("Análise de jogos")}</h2><p>{t("Não há jogos em destaque guardados.")}</p><Link href={homeHref("/jogos", locale)}>{t("Escolher um jogo")} ↗</Link></section>}
          <Suspense fallback={<p className="premium-panel p-5 text-muted">{t("Classificação")}…</p>}><HomeStandings catalog={catalog} locale={locale} /></Suspense>
          <section className="premium-panel intelligence-card">
            <p className="panel-kicker">{locale === "en-US" ? "BEHIND THE NUMBERS" : "POR TRÁS DOS NÚMEROS"}</p>
            <h2>{locale === "en-US" ? "A complete view of every game." : locale === "pt-BR" ? "Uma visão completa de cada partida." : "Uma visão completa de cada jogo."}</h2>
            <p>{locale === "en-US" ? "Team strength, recent form, head-to-head and comparative charts. 1X2 probabilities appear on the game page only when the existing model has sufficient data." : locale === "pt-BR" ? "Força dos times, forma recente, confrontos diretos e gráficos comparativos. As probabilidades 1X2 aparecem na ficha da partida apenas quando o modelo tem dados suficientes." : "Força das equipas, forma recente, confrontos diretos e gráficos comparativos. As probabilidades 1X2 aparecem na ficha do jogo apenas quando o modelo tem dados suficientes."}</p>
            <ul className="analysis-topics"><li>{t("Probabilidades")} · 1 / X / 2</li><li>{t("Confrontos diretos")}</li><li>{t("Últimos jogos")}</li></ul>
            <Link href={homeHref(lead ? `/jogos/${lead.externalId}` : "/analise", locale)}>{t("Abrir a análise")} ↗</Link>
          </section>
        </aside>
      </div>
      <section className="premium-panel competitions-section">
        <SectionHead title={t("Competições")} href="/competicoes" action={t("Ver todas")} locale={locale} />
        {featuredCompetitions.length === 0 ? <p className="editorial-empty">{t("Não há competições guardadas.")}</p> : <ul className="competition-grid">
          {featuredCompetitions.map(competition => <li key={competition.code}><CompetitionLink href={homeHref(`/competicoes/${competition.code}`, locale)} name={competition.name} emblemUrl={competition.emblemUrl} detail={t(formatCountry(competition.country))} meta={t("Classificação")} /></li>)}
        </ul>}
      </section>
      <Suspense fallback={<p className="premium-panel p-5 text-muted">{t("Leituras")}…</p>}><HomeArticles locale={locale} /></Suspense>
      <section className="premium-panel shortcuts-section">
        <SectionHead title={t("Acesso rápido")} href="/jogos" action={t("Ver o quadro")} locale={locale} />
        <ul className="shortcut-grid">{shortcuts.map(item => <li key={item.href}><Link href={homeHref(item.href, locale)}><span>{t(item.label)}</span><small>{t(item.text)}</small><span aria-hidden="true">↗</span></Link></li>)}</ul>
      </section>
    </div>
  );
}

const shortcuts = [
  { href: "/jogos", label: "Jogos", text: "Quadro do dia, por competição" },
  { href: "/competicoes", label: "Competições", text: "Tabelas e calendário" },
  { href: "/pesquisa", label: "Equipas", text: "Pesquisa de clubes" },
  { href: "/avaliacao", label: "Estatísticas", text: "Leitura das competições guardadas" },
  { href: "/analise", label: "Análises", text: "Ficha do jogo e estimativa 1X2" },
  { href: "/noticias", label: "Notícias", text: "Só fontes autorizadas" },
];

function rankCompetition(code: string) {
  const order = ["PPL", "PL", "CL", "PD", "SA", "BL1", "FL1", "DED"];
  const index = order.indexOf(code);
  return index === -1 ? order.length : index;
}

async function standingsPreview(catalog: Awaited<ReturnType<typeof listCompetitions>>) {
  const league = catalog.find((item) => item.code === "PPL") ?? catalog.find((item) => item.code === "PL");
  if (!league) return null;
  const table = (await homeStandings(league.id)).filter((item) => item.teamName && item.position != null);
  if (table.length < 4) return null;
  return { code: league.code, name: league.name, rows: table.slice(0, 6) };
}

function SectionHead({ title, href, action, locale = "pt-PT" }: { title: string; href: string; action: string; locale?: Locale }) {
  return (
    <div className="section-heading">
      <h2 className="font-serif text-2xl">{homeText(locale, title)}</h2>
      <Link href={homeHref(href, locale)} className="text-sm text-accent underline-offset-4 hover:underline">
        {homeText(locale, action)}
      </Link>
    </div>
  );
}

function Count({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Reveal>
      <Link href={href} className="daily-counter">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 font-serif text-3xl text-primary">
          <CountUp value={value} kind="int" />
        </p>
      </Link>
    </Reveal>
  );
}

function Lead({ match, locale }: { match: DayMatch; locale: Locale }) {
  const t = (text: string) => homeText(locale, text);
  const group = matchGroup(match.status);
  const kicker = group === "live" ? t("Em direto") : group === "upcoming" ? t("Próximo jogo") : (locale === "en-US" ? "Recent result" : locale === "pt-BR" ? "Resultado recente" : "Resultado recente");
  return (
    <article className="premium-panel featured-match">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("Destaque")} · {kicker}</p>
      <p className="mt-2 text-sm text-muted">{match.competitionName}</p>
      <div className="featured-match__teams">
        <Team name={match.homeName} crest={match.homeCrest} />
        <p className="featured-match__score tabular">{scoreLabel(match, locale)}</p>
        <Team name={match.awayName} crest={match.awayCrest} align="end" />
      </div>
      <p className="mt-3 text-sm text-muted">
        {homeDateTime(match.utcDate, locale)} · {t(formatStatus(match.status))}
      </p>
      <p className="mt-2 text-xs text-muted">{locale === "en-US" ? "Saved status. Updated:" : "Estado guardado. Atualizado em:"} {homeDateTime(match.fetchedAt, locale)}</p>
      <p className="mt-2 text-sm">{homeResultDetails(match, locale).join(" · ")}</p>
      <Suspense fallback={null}><FeaturedProbabilities match={match} locale={locale} /></Suspense>
      <Link href={homeHref(`/jogos/${match.externalId}`, locale)} className="btn mt-4">
        {t("Abrir a análise")}
      </Link>
    </article>
  );
}

async function FeaturedProbabilities({ match, locale }: { match: DayMatch; locale: Locale }) {
  const estimates = await estimatesForMatches([match]);
  const shares = estimates.get(match.externalId);
  return shares ? <ProbabilityTiles shares={shares} locale={locale} /> : (
    <p className="mt-3 text-xs text-muted">{locale === "en-US" ? "Estimate unavailable: not enough previous games in this competition." : "Estimativa indisponível: faltam jogos anteriores nesta competição."}</p>
  );
}

function Team({ name, crest, align = "start" }: { name: string; crest: string | null; align?: "start" | "end" }) {
  return (
    <p className={`featured-team ${align === "end" ? "featured-team--away" : ""}`}>
      <Crest src={crest} name={name} />
      <span>{name}</span>
    </p>
  );
}

function MatchSection({
  title,
  action,
  empty,
  matches,
  locale,
}: {
  title: string;
  action: string;
  empty: string;
  matches: DayMatch[];
  locale: Locale;
}) {
  const t = (text: string) => homeText(locale, text);
  return (
    <section className="home-matches">
      <SectionHead title={title} href="/jogos" action={action} locale={locale} />
      {matches.length === 0 ? (
        <p className="board-empty">{empty}</p>
      ) : (
        <ul className="home-match-list">
          {matches.map((match) => (
            <li key={match.externalId}>
              <Link href={homeHref(`/jogos/${match.externalId}`, locale)} className="home-match-row home-match-row--saved">
                <span className="home-match-row__time">{homeDateTime(match.utcDate, locale)}</span>
                <span className="min-w-0">
                  <span className="home-match-row__teams"><span><Crest src={match.homeCrest} name={match.homeName} />{match.homeName}</span><span><Crest src={match.awayCrest} name={match.awayName} />{match.awayName}</span></span>
                  <span className="mt-0.5 block text-xs text-muted">{homeResultDetails(match, locale).join(" · ")}</span>
                  <span className="mt-0.5 block text-xs text-muted">{match.competitionName} · {t(formatStatus(match.status))} · {locale === "en-US" ? "Updated:" : "Atualizado:"} {homeDateTime(match.fetchedAt, locale)}</span>
                </span>
                <span className={`score-pill ${matchGroup(match.status) === "live" ? "score-pill--live" : ""}`}>{scoreLabel(match, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StandingsPreview({
  table,
  locale,
}: {
  table: NonNullable<Awaited<ReturnType<typeof standingsPreview>>>;
  locale: Locale;
}) {
  const t = (text: string) => homeText(locale, text);
  return (
    <section className="premium-panel standings-panel">
      <SectionHead title={t("Classificação")} href={`/competicoes/${table.code}`} action={t("Tabela completa")} locale={locale} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">{table.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2">{t("Pos")}</th>
              <th scope="col" className="px-3 py-2">{t("Equipa")}</th>
              <th scope="col" className="px-3 py-2 text-right">{locale === "en-US" ? "GP" : "J"}</th>
              <th scope="col" className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.teamExternalId}>
                <td className="px-3 py-2 tabular">{row.position}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Crest src={row.crestUrl} name={row.teamName} />
                    <Link href={homeHref(`/equipas/${row.teamExternalId}`, locale)} className="truncate hover:underline">
                      {row.teamName}
                    </Link>
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular text-muted">{row.played}</td>
                <td className="px-3 py-2 text-right font-semibold tabular">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function scoreLabel(match: DayMatch, locale: Locale) {
  if (match.regularHome != null && match.regularAway != null) return `${match.regularHome}–${match.regularAway}`;
  if (matchGroup(match.status) === "upcoming") return formatLisbonTime(match.utcDate);
  return homeText(locale, formatStatus(match.status));
}

async function HomeNews({ locale }: { locale: Locale }) {
  const t = (text: string) => homeText(locale, text);
  const [feed, published] = await Promise.all([readNews(), publicArticles()]);
  const news = feed.slice(0, 3);
  const editorial = published.filter(article => article.editorialType === "news" && article.verifiedAt).slice(0, 3);
  return (
    <section className="premium-panel editorial-section">
      <SectionHead title={t("Notícias")} href="/noticias" action={t("Ver notícias")} locale={locale} />
      {editorial.length > 0 ? <ul className="news-list">{editorial.map((article, index) => <li key={article.slug}>
        <span className="news-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div>
          <p className="text-xs text-muted">{article.author}</p>
          <h3 className="mt-1 font-serif text-xl"><Link href={`/blog/${article.slug}`} className="hover:underline">{article.title}</Link></h3>
          <p className="mt-2 text-sm text-muted">{article.summary}</p>
        </div>
      </li>)}</ul> : null}
      {news.length === 0 ? (
        editorial.length === 0 ? <p className="border border-line bg-card px-4 py-6 text-sm text-muted">{t("Não há notícias relevantes confirmadas encontradas.")}</p> : null
      ) : (
        <ul className="news-list">
          {news.map((item, index) => (
            <li key={item.id}><span className="news-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {item.sourceName} · {locale === "en-US" ? "Unconfirmed" : "Não confirmado"}
              </p>
              <h3 className={`mt-1 font-serif ${index === 0 ? "text-2xl" : "text-lg"}`}>
                <a href={item.url} className="hover:underline" rel="noreferrer">
                  {item.title}
                </a>
              </h3>
              <p className="mt-2 text-sm text-muted">{item.summary}</p></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function HomeArticles({ locale }: { locale: Locale }) {
  const t = (text: string) => homeText(locale, text);
  const articles = (await publicArticles()).slice(0, 3);
  return articles.length > 0 ? (
    <section className="reading-section">
      <SectionHead title={t("Leituras")} href="/blog" action={t("Ver os artigos")} locale={locale} />
      <p className="text-sm text-muted">{locale === "en-US" ? "Football news and analysis with identified sources. Sample articles are labelled." : "Notícias e análises de futebol com fontes identificadas. Os artigos de exemplo estão assinalados."}</p>
      <ul className="reading-grid">
        {articles.map((article) => (
          <li key={article.slug}>
            <article className="premium-panel reading-card">
              {article.coverImage && (article.coverImage.provider === "local-ai" || article.coverImage.licenseVerified) ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
              <div className="reading-card__body"><p className="panel-kicker">{article.category}</p>
              <h3 className="font-serif text-xl">
                <Link href={homeHref(`/blog/${article.slug}`, locale)} className="hover:underline">
                  {article.title}
                </Link>
              </h3>
              <p className="text-sm text-muted">{article.summary}</p>
              <p className="text-xs text-muted">{new Intl.DateTimeFormat(locale, { timeZone: "Europe/Lisbon", dateStyle: "medium" }).format(new Date(article.publishedAt))}{article.example ? ` · ${t("Artigo de exemplo")}` : article.editorialType === "news" ? ` · ${locale === "en-US" ? "Editorial news" : "Notícia editorial"}` : ""}</p></div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}

async function HomeStandings({ catalog, locale }: { catalog: Awaited<ReturnType<typeof listCompetitions>>; locale: Locale }) {
  const table = await standingsPreview(catalog);
  return table ? <StandingsPreview table={table} locale={locale} /> : null;
}

function homeHref(path: string, locale: Locale) {
  return `${localePrefix(locale)}${path === "/" ? "" : path}`;
}
