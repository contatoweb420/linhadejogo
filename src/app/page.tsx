import Link from "next/link";
import { CountUp, Reveal } from "@/components/chart-motion";
import { CompetitionLink } from "@/components/competition-link";
import { Cover } from "@/components/cover";
import { LedSign } from "@/components/led-sign";
import { Crest } from "@/components/crest";
import { SetupPanel } from "@/components/setup-panel";
import { formatArticleDate } from "@/content/blog";
import { publicArticles } from "@/server/blog-agent/public";
import { pingDatabase } from "@/server/db/client";
import { formatCountry, formatLisbonTime, formatStatus, lisbonToday, matchGroup } from "@/server/format/pt";
import { syncWindow } from "@/server/ingest/sync";
import { readNews } from "@/server/news/store";
import { competitionTable, getCompetition, listCompetitions, listMatchesForDay } from "@/server/queries";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export const metadata = { title: "Visão geral", description: "Consulte jogos de futebol, classificações, resultados e estimativas estatísticas da Linha de Jogo." };

type DayMatch = Awaited<ReturnType<typeof listMatchesForDay>>[number];

export default async function HomePage() {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const today = lisbonToday();
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  const sync = await syncWindow(today);
  const [matches, catalog] = await Promise.all([listMatchesForDay(today), listCompetitions()]);
  const live = matches.filter((match) => matchGroup(match.status) === "live");
  const upcoming = matches.filter((match) => matchGroup(match.status) === "upcoming");
  const finished = matches.filter((match) => matchGroup(match.status) === "finished");
  const lead = live[0] ?? upcoming[0] ?? finished[finished.length - 1] ?? null;
  const board = [...live, ...upcoming, ...[...finished].reverse()]
    .filter((match) => match.externalId !== lead?.externalId)
    .slice(0, 6);
  const articles = (await publicArticles()).slice(0, 3);
  const news = (await readNews()).slice(0, 3);
  const featuredCompetitions = [...catalog].sort((a, b) => rankCompetition(a.code) - rankCompetition(b.code)).slice(0, 8);
  const standings = await standingsPreview(catalog);

  return (
    <div className="grid gap-8">
      <header className="grid min-w-0 gap-2">
        <LedSign />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{locale === "en-US" ? "Today" : "Hoje"}</p>
        <h1>{new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "Europe/Lisbon" }).format(new Date(`${today}T12:00:00Z`))}</h1>
        <p className="max-w-2xl text-sm text-muted">
          {locale === "en-US" ? "Games saved for this date. Numbers come from local data collection. When data is missing, the page says ‘Unavailable’." : locale === "pt-BR" ? "Partidas salvas para esta data. Os números vêm da coleta local. Quando um dado não existe, a página informa ‘Indisponível’." : "Jogos guardados para esta data. Os números vêm da recolha local. Quando um dado não existe, a página indica «Não disponível»."}
        </p>
      </header>

      {sync.message ? (
        <p className="border border-line bg-card px-4 py-3 text-sm text-muted" role="status">
          {sync.message}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("Jogos de hoje")}>
        <Count label={t("Em direto")} value={live.length} href="/jogos" />
        <Count label={t("Por disputar")} value={upcoming.length} href="/jogos" />
        <Count label={t("Terminados")} value={finished.length} href="/jogos" />
      </section>

      {lead ? <Lead match={lead} locale={locale} /> : <p className="text-sm text-muted">{t("Não há jogos guardados para hoje.")}</p>}

      {board.length > 0 ? (
        <MatchSection title={t("Jogos de hoje")} action={t("Ver o quadro")} empty="" matches={board} locale={locale} />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="grid content-start gap-3">
          <SectionHead title={t("Competições")} href="/competicoes" action={t("Ver todas")} locale={locale} />
          {featuredCompetitions.length === 0 ? (
            <p className="text-sm text-muted">Não há competições guardadas.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featuredCompetitions.map((competition) => (
                <li key={competition.code} className="h-full">
                  <CompetitionLink
                    href={`/competicoes/${competition.code}`}
                    name={competition.name}
                    emblemUrl={competition.emblemUrl}
                    detail={formatCountry(competition.country)}
                    meta={t("Classificação")}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        {standings ? <StandingsPreview table={standings} locale={locale} /> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
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
        <section className="grid content-start gap-3 border border-line bg-card p-4">
          <h2 className="font-serif text-2xl">{t("Análises")}</h2>
          <p className="text-sm text-muted">
            {locale === "en-US" ? "Team comparisons, recent form, and 1X2 predictions appear on each game's page. Predictions appear only when the model has enough data." : locale === "pt-BR" ? "A comparação dos times, a forma recente e a previsão 1X2 ficam na página de cada partida. A previsão só aparece quando o modelo tem dados suficientes." : "A comparação das equipas, a forma recente e a estimativa 1X2 estão na ficha de cada jogo. A estimativa só aparece quando o modelo tem dados suficientes."}
          </p>
          <Link href={lead ? `/jogos/${lead.externalId}` : "/jogos"} className="btn w-fit">
            {lead ? (locale === "en-US" ? "Open featured preview" : locale === "pt-BR" ? "Ver análise do destaque" : "Abrir a análise do destaque") : t("Escolher um jogo")}
          </Link>
        </section>
      </div>

      {articles.length > 0 ? (
        <section className="grid gap-3">
          <SectionHead title={t("Leituras")} href="/blog" action={t("Ver os artigos")} locale={locale} />
          <p className="text-sm text-muted">{locale === "en-US" ? "Sample articles about reading statistics. These are not real game news." : locale === "pt-BR" ? "Textos de exemplo sobre análise estatística. Não são notícias de partidas reais." : "Textos de exemplo sobre leitura estatística. Não são notícias de jogos reais."}</p>
          <ul className="grid gap-4 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <article className="grid h-full gap-3 border border-line bg-card p-3">
                  <Cover scene={article.cover} label={article.title} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{article.category}</p>
                  <h3 className="font-serif text-xl">
                    <Link href={`/blog/${article.slug}`} className="hover:underline">
                      {article.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted">{article.summary}</p>
                  <p className="text-xs text-muted">{formatArticleDate(article.publishedAt)} · {t("Artigo de exemplo")}</p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="border-b border-line pb-2 font-serif text-2xl">{t("Acesso rápido")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="grid h-full gap-1 border border-line bg-card px-4 py-3 hover:bg-raised">
                <span className="font-serif text-xl text-foreground">{item.label}</span>
                <span className="text-sm text-muted">{item.text}</span>
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
  const row = await getCompetition(league.code);
  if (!row) return null;
  const table = (await competitionTable(row.id, "TOTAL")).filter((item) => item.teamName && item.position != null);
  if (table.length < 4) return null;
  return { code: league.code, name: league.name, rows: table.slice(0, 6) };
}

function SectionHead({ title, href, action, locale = "pt-PT" }: { title: string; href: string; action: string; locale?: Locale }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h2 className="font-serif text-2xl">{translate(locale, title)}</h2>
      <Link href={href} className="text-sm text-accent underline-offset-4 hover:underline">
        {translate(locale, action)}
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
  const t = (text: string) => translate(locale, text);
  const group = matchGroup(match.status);
  const kicker = group === "live" ? t("Em direto") : group === "upcoming" ? t("Próximo jogo") : (locale === "en-US" ? "Recent result" : locale === "pt-BR" ? "Resultado recente" : "Resultado recente");
  return (
    <article className="border border-line bg-card p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Destaque · {kicker}</p>
      <p className="mt-2 text-sm text-muted">{match.competitionName}</p>
      <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Team name={match.homeName} crest={match.homeCrest} />
        <p className="font-serif text-4xl tabular text-primary sm:text-center">{scoreLabel(match)}</p>
        <Team name={match.awayName} crest={match.awayCrest} align="end" />
      </div>
      <p className="mt-3 text-sm text-muted">
        {formatLisbonTime(match.utcDate)} · {formatStatus(match.status)}
      </p>
      <Link href={`/jogos/${match.externalId}`} className="btn mt-4">
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
  return (
    <section className="grid content-start gap-3">
      <SectionHead title={title} href="/jogos" action={action} locale={locale} />
      {matches.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-card">
          {matches.map((match) => (
            <li key={match.externalId}>
              <Link href={`/jogos/${match.externalId}`} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-3 py-3 text-sm hover:bg-raised">
                <span className="text-muted">{formatLisbonTime(match.utcDate)}</span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {match.homeName} – {match.awayName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{match.competitionName}</span>
                </span>
                <span className="font-semibold tabular text-primary">{scoreLabel(match)}</span>
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
  const t = (text: string) => translate(locale, text);
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
                    <Link href={`/equipas/${row.teamExternalId}`} className="truncate hover:underline">
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

function scoreLabel(match: DayMatch) {
  if (match.regularHome != null && match.regularAway != null) return `${match.regularHome}–${match.regularAway}`;
  if (matchGroup(match.status) === "upcoming") return formatLisbonTime(match.utcDate);
  return formatStatus(match.status);
}
