import Link from "next/link";
import { Suspense } from "react";
import { CountUp, Reveal } from "@/components/chart-motion";
import { CompetitionLink } from "@/components/competition-link";
import { Cover } from "@/components/cover";
import { EditorialImage } from "@/components/editorial-image";
import { LedSign } from "@/components/led-sign";
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
    <div className="grid gap-8" data-home-ready>
      <header className="grid min-w-0 gap-2">
        <LedSign />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{locale === "en-US" ? "Today" : "Hoje"}</p>
        <h1>{new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(new Date(`${today}T12:00:00Z`))}</h1>
        <p className="max-w-2xl text-sm text-muted">
          {locale === "en-US" ? "Saved games and results. The summary refers to today; lists also include recent results and upcoming dates. Updates run independently of this page." : locale === "pt-BR" ? "Partidas e resultados salvos. O resumo é de hoje; as listas também incluem resultados recentes e próximas datas. A atualização é independente desta página." : "Jogos e resultados guardados. O resumo refere-se a hoje; as listas incluem também resultados recentes e próximas datas. A atualização é independente desta página."}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("Jogos de hoje")}>
        <Count label={t("Em direto")} value={summary.live} href={homeHref("/jogos", locale)} />
        <Count label={t("Por disputar")} value={summary.upcoming} href={homeHref("/jogos", locale)} />
        <Count label={t("Terminados")} value={summary.finished} href={homeHref("/jogos", locale)} />
      </section>

      {lead ? <Lead match={lead} locale={locale} /> : <p className="text-sm text-muted">{t("Não há jogos em destaque guardados.")}</p>}

      <MatchSection title={locale === "en-US" ? "Recent results" : "Resultados recentes"} action={t("Ver o quadro")} empty={locale === "en-US" ? "No saved results available." : "Não há resultados guardados disponíveis."} matches={finished} locale={locale} />
      <p className="text-xs text-muted">{t("Os estados apresentados são os guardados, incluindo jogos de datas anteriores ainda marcados como em direto.")}</p>
      <Link href={homeHref("/jogos", locale)} className="text-sm text-accent underline">{t("Ver jogos, incluindo adiados e cancelados")}</Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <MatchSection title={t("Em direto")} action={t("Ver o quadro")} empty={locale === "en-US" ? "No games saved as live today." : "Não há jogos guardados como em direto hoje."} matches={live} locale={locale} />
        <MatchSection title={locale === "en-US" ? "Upcoming games" : "Próximos jogos"} action={t("Ver o quadro")} empty={locale === "en-US" ? "No upcoming games saved." : "Não há próximos jogos guardados."} matches={upcoming} locale={locale} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="grid content-start gap-3">
          <SectionHead title={t("Competições")} href="/competicoes" action={t("Ver todas")} locale={locale} />
          {featuredCompetitions.length === 0 ? (
            <p className="text-sm text-muted">{t("Não há competições guardadas.")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featuredCompetitions.map((competition) => (
                <li key={competition.code} className="h-full">
                  <CompetitionLink
                    href={homeHref(`/competicoes/${competition.code}`, locale)}
                    name={competition.name}
                    emblemUrl={competition.emblemUrl}
                    detail={t(formatCountry(competition.country))}
                    meta={t("Classificação")}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <Suspense fallback={<p className="text-sm text-muted">{t("Classificação")}…</p>}>
          <HomeStandings catalog={catalog} locale={locale} />
        </Suspense>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <Suspense fallback={<p className="text-sm text-muted">{t("Notícias")}…</p>}>
          <HomeNews locale={locale} />
        </Suspense>
        <section className="grid content-start gap-3 border border-line bg-card p-4">
          <h2 className="font-serif text-2xl">{t("Análises")}</h2>
          <p className="text-sm text-muted">
            {locale === "en-US" ? "Team comparisons, recent form, and 1X2 predictions appear on each game's page. Predictions appear only when the model has enough data." : locale === "pt-BR" ? "A comparação dos times, a forma recente e a previsão 1X2 ficam na página de cada partida. A previsão só aparece quando o modelo tem dados suficientes." : "A comparação das equipas, a forma recente e a estimativa 1X2 estão na ficha de cada jogo. A estimativa só aparece quando o modelo tem dados suficientes."}
          </p>
          <Link href={homeHref(lead ? `/jogos/${lead.externalId}` : "/jogos", locale)} className="btn w-fit">
            {lead ? (locale === "en-US" ? "Open featured preview" : locale === "pt-BR" ? "Ver análise do destaque" : "Abrir a análise do destaque") : t("Escolher um jogo")}
          </Link>
        </section>
      </div>

      <Suspense fallback={<p className="text-sm text-muted">{t("Leituras")}…</p>}>
        <HomeArticles locale={locale} />
      </Suspense>

      <section className="grid gap-3">
        <h2 className="border-b border-line pb-2 font-serif text-2xl">{t("Acesso rápido")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link href={homeHref(item.href, locale)} className="grid h-full gap-1 border border-line bg-card px-4 py-3 hover:bg-raised">
                <span className="font-serif text-xl text-foreground">{t(item.label)}</span>
                <span className="text-sm text-muted">{t(item.text)}</span>
              </Link>
            </li>
          ))}
        </ul>
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
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
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
      <Link href={href} className="stat-card block border border-line bg-card px-4 py-3 hover:bg-raised">
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
    <article className="border border-line bg-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("Destaque")} · {kicker}</p>
      <p className="mt-2 text-sm text-muted">{match.competitionName}</p>
      <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Team name={match.homeName} crest={match.homeCrest} />
        <p className="font-serif text-4xl tabular text-primary sm:text-center">{scoreLabel(match, locale)}</p>
        <Team name={match.awayName} crest={match.awayCrest} align="end" />
      </div>
      <p className="mt-3 text-sm text-muted">
        {homeDateTime(match.utcDate, locale)} · {t(formatStatus(match.status))}
      </p>
      <p className="mt-2 text-xs text-muted">{locale === "en-US" ? "Saved status. Updated:" : "Estado guardado. Atualizado em:"} {homeDateTime(match.fetchedAt, locale)}</p>
      <p className="mt-2 text-sm">{homeResultDetails(match, locale).join(" · ")}</p>
      <Link href={homeHref(`/jogos/${match.externalId}`, locale)} className="btn mt-4">
        {t("Abrir a análise")}
      </Link>
    </article>
  );
}

function Team({ name, crest, align = "start" }: { name: string; crest: string | null; align?: "start" | "end" }) {
  return (
    <p className={`flex items-center gap-3 ${align === "end" ? "sm:flex-row-reverse sm:text-right" : ""}`}>
      <Crest src={crest} name={name} />
      <span className="font-serif text-2xl">{name}</span>
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
    <section className="grid content-start gap-3">
      <SectionHead title={title} href="/jogos" action={action} locale={locale} />
      {matches.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-card">
          {matches.map((match) => (
            <li key={match.externalId}>
              <Link href={homeHref(`/jogos/${match.externalId}`, locale)} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 px-3 py-3 text-sm hover:bg-raised">
                <span className="text-muted">{homeDateTime(match.utcDate, locale)}</span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {match.homeName} – {match.awayName}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{homeResultDetails(match, locale).join(" · ")}</span>
                  <span className="mt-0.5 block text-xs text-muted">{match.competitionName} · {t(formatStatus(match.status))} · {locale === "en-US" ? "Updated:" : "Atualizado:"} {homeDateTime(match.fetchedAt, locale)}</span>
                </span>
                <span className="font-semibold tabular text-primary">{scoreLabel(match, locale)}</span>
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
    <section className="grid content-start gap-3">
      <SectionHead title={t("Classificação")} href={`/competicoes/${table.code}`} action={t("Tabela completa")} locale={locale} />
      <div className="overflow-x-auto border border-line bg-card">
        <table className="w-full min-w-[18rem] text-left text-sm">
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
  const news = (await readNews()).slice(0, 3);
  return (
    <section className="grid content-start gap-3">
      <SectionHead title={t("Notícias")} href="/noticias" action={t("Ver notícias")} locale={locale} />
      {news.length === 0 ? (
        <p className="border border-line bg-card px-4 py-6 text-sm text-muted">{t("Não há notícias relevantes confirmadas encontradas.")}</p>
      ) : (
        <ul className="grid gap-3">
          {news.map((item, index) => (
            <li key={item.id} className="border border-line bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {item.sourceName} · {locale === "en-US" ? "Unconfirmed" : "Não confirmado"}
              </p>
              <h3 className={`mt-1 font-serif ${index === 0 ? "text-2xl" : "text-lg"}`}>
                <a href={item.url} className="hover:underline" rel="noreferrer">
                  {item.title}
                </a>
              </h3>
              <p className="mt-2 text-sm text-muted">{item.summary}</p>
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
    <section className="grid gap-3">
      <SectionHead title={t("Leituras")} href="/blog" action={t("Ver os artigos")} locale={locale} />
      <p className="text-sm text-muted">{locale === "en-US" ? "Football news and analysis with identified sources. Sample articles are labelled." : "Notícias e análises de futebol com fontes identificadas. Os artigos de exemplo estão assinalados."}</p>
      <ul className="grid gap-4 lg:grid-cols-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <article className="grid h-full gap-3 border border-line bg-card p-3">
              {article.coverImage?.provider === "local-ai" ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{article.category}</p>
              <h3 className="font-serif text-xl">
                <Link href={homeHref(`/blog/${article.slug}`, locale)} className="hover:underline">
                  {article.title}
                </Link>
              </h3>
              <p className="text-sm text-muted">{article.summary}</p>
              <p className="text-xs text-muted">{new Intl.DateTimeFormat(locale, { timeZone: "Europe/Lisbon", dateStyle: "medium" }).format(new Date(article.publishedAt))}{article.example ? ` · ${t("Artigo de exemplo")}` : article.editorialType === "news" ? ` · ${locale === "en-US" ? "Editorial news" : "Notícia editorial"}` : ""}</p>
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
