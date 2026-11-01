import { PredictionChart } from "@/components/prediction-chart";
import { Reveal } from "@/components/chart-motion";
import { ComparisonBars, EmptyNote, OutcomeBars } from "@/components/stat-bars";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { translate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";
import { formatLocaleNumber, formatLocalePercent } from "@/lib/i18n";
import { actualOutcome, hitRate, predictedOutcome } from "@/server/stats/outcomes";
import {
  competitionsWithResults,
  currentStandings,
  outcomeDistribution,
  settledPredictions,
} from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  return locale === "en-US"
    ? { title: "Statistics", description: "Review the historical accuracy of Linha de Jogo statistical predictions." }
    : locale === "pt-BR"
      ? { title: "Estatísticas", description: "Consulte o histórico de avaliação das previsões estatísticas da Linha de Jogo." }
      : { title: "Estatísticas", description: "Consulte o histórico de avaliação das estimativas estatísticas da Linha de Jogo." };
}

const outcomeKey = { home: "vitória da casa", draw: "empate", away: "vitória visitante" } as const;

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ competicao?: string; a?: string; b?: string }>;
}) {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  const params = await searchParams;
  const code = (params.competicao ?? "").trim();
  const [competitions, distribution, table, stored] = await Promise.all([
    competitionsWithResults(),
    outcomeDistribution(code || null),
    code ? currentStandings(code) : Promise.resolve([]),
    settledPredictions(),
  ]);

  const competition = competitions.find((item) => item.code === code) ?? null;
  const teamA = table.some((team) => String(team.teamExternalId) === params.a) ? (params.a ?? "") : "";
  const teamB = table.some((team) => String(team.teamExternalId) === params.b) ? (params.b ?? "") : "";
  const total = distribution.home + distribution.draw + distribution.away;
  const calls = stored.flatMap((row) => {
    if (row.regularHome == null || row.regularAway == null) return [];
    return [
      {
        key: `${row.utcDate.toISOString()}-${row.homeName}-${row.awayName}`,
        date: row.utcDate.toISOString(),
        homeName: row.homeName,
        awayName: row.awayName,
        goalsHome: row.regularHome,
        goalsAway: row.regularAway,
        home: row.homeProbability,
        draw: row.drawProbability,
        away: row.awayProbability,
      },
    ];
  });
  const accuracy = hitRate(calls);
  const recent = calls.slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl">{t("Estatísticas")}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          {locale === "en-US"
            ? "Official results from completed games stored in the local database. Shots, possession, and corner kicks are not currently collected, so they are not included in these charts."
            : locale === "pt-BR"
              ? "Resultados oficiais das partidas concluídas que estão no banco de dados local. Finalizações, posse de bola e escanteios ainda não são coletados e, por isso, não aparecem nestes gráficos."
              : "Resultados regulamentares dos jogos terminados guardados na base de dados local. Remates, posse de bola e pontapés de canto não são recolhidos atualmente, por isso não aparecem nestes gráficos."}
        </p>
      </header>

      <Filter competitions={competitions} code={competition ? code : ""} table={table} teamA={teamA} teamB={teamB} locale={locale} />

      {total === 0 ? (
        <EmptyNote
          title={t("Distribuição de resultados")}
          text={
            code && !competition
              ? t("Esta competição não tem jogos terminados na base local.")
              : t("Ainda não há jogos terminados com marcador regulamentar. Quando a recolha os guardar, a distribuição de vitórias e empates aparece aqui.")
          }
        />
      ) : (
        <Reveal>
        <section className="stat-card border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">{t("Distribuição de resultados")}</h2>
          <p className="mt-1 text-sm text-muted">
            {competition ? competition.name : t("Todas as competições")} · {formatLocaleNumber(total, locale)} {locale === "en-US" ? "completed games" : locale === "pt-BR" ? "partidas concluídas" : "jogos terminados"}
          </p>
          <div className="mt-5">
            <OutcomeBars home={distribution.home} draw={distribution.draw} away={distribution.away} locale={locale} />
          </div>
        </section>
        </Reveal>
      )}

      <Comparison competitionName={competition?.name ?? null} code={code} table={table} teamA={teamA} teamB={teamB} locale={locale} />

      {accuracy.settled === 0 ? (
        <EmptyNote
          title={t("Taxa de acerto")}
          text={t("Ainda não há previsões guardadas antes do apito inicial com o jogo já terminado. A taxa só conta esses registos.")}
        />
      ) : (
        <Reveal>
        <section className="stat-card border border-line bg-card p-5">
          <h2 className="font-serif text-2xl">{t("Taxa de acerto")}</h2>
          <p className="mt-2 text-sm leading-6">
            {formatLocaleNumber(accuracy.hits, locale)} {locale === "en-US" ? "of" : "em"} {formatLocaleNumber(accuracy.settled, locale)} ({formatLocalePercent(accuracy.rate ?? 0, locale)}) {t("acertaram o resultado de casa, empate ou fora. Cada previsão foi gravada antes do início do jogo.")}
          </p>
          {accuracy.rate != null ? <PredictionChart points={accuracyPoints(calls, locale)} rate={accuracy.rate} locale={locale} /> : null}
          <ul className="mt-4 divide-y divide-row text-sm">
            {recent.map((row) => {
              const picked = predictedOutcome(row.home, row.draw, row.away);
              const actual = actualOutcome(row.goalsHome, row.goalsAway);
              const hit = picked === actual;
              return (
                <li key={row.key} className="py-2">
                  {row.homeName} {row.goalsHome}–{row.goalsAway} {row.awayName}
                  <span className="text-muted">
                    {" "}
                    · {t("previsão")}: {t(outcomeKey[picked])} · {hit ? t("acertou") : t("falhou")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        </Reveal>
      )}
    </div>
  );
}

function Filter({
  competitions,
  code,
  table,
  teamA,
  teamB,
  locale,
}: {
  competitions: Array<{ code: string; name: string }>;
  code: string;
  table: Array<{ teamExternalId: number; teamName: string; groupName: string }>;
  teamA: string;
  teamB: string;
  locale: Locale;
}) {
  const t = (text: string) => translate(locale, text);
  const showGroup = new Set(table.map((team) => team.groupName).filter(Boolean)).size > 1;
  return (
    <form method="get" className="grid gap-3 border border-line bg-card p-4 md:grid-cols-4 md:items-end">
      <label className="block text-sm">
        <span className="text-muted">{t("Competição")}</span>
        <select name="competicao" defaultValue={code} className="select">
          <option value="">{t("Todas")}</option>
          {competitions.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <TeamField name="a" label={t("Equipa A")} table={table} value={teamA} showGroup={showGroup} code={code} locale={locale} />
      <TeamField name="b" label={t("Equipa B")} table={table} value={teamB} showGroup={showGroup} code={code} locale={locale} />
      <button className="btn min-h-11" type="submit">
        {t("Atualizar")}
      </button>
    </form>
  );
}

function TeamField({
  name,
  label,
  table,
  value,
  showGroup,
  code,
  locale,
}: {
  name: string;
  label: string;
  table: Array<{ teamExternalId: number; teamName: string; groupName: string }>;
  value: string;
  showGroup: boolean;
  code: string;
  locale: Locale;
}) {
  const emptyLabel = table.length > 0 ? translate(locale, "Escolher") : code ? translate(locale, "Sem classificação") : translate(locale, "Escolhe uma competição");
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <select name={name} defaultValue={value} disabled={table.length === 0} className="select disabled:opacity-50">
        <option value="">{emptyLabel}</option>
        {table.map((team) => (
          <option key={`${team.groupName}-${team.teamExternalId}`} value={team.teamExternalId}>
            {showGroup && team.groupName ? `${team.teamName} · ${team.groupName}` : team.teamName}
          </option>
        ))}
      </select>
    </label>
  );
}

function Comparison({
  competitionName,
  code,
  table,
  teamA,
  teamB,
  locale,
}: {
  competitionName: string | null;
  code: string;
  table: Array<{
    teamExternalId: number;
    teamName: string;
    played: number;
    won: number;
    draw: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }>;
  teamA: string;
  teamB: string;
  locale: Locale;
}) {
  const t = (text: string) => translate(locale, text);
  if (!code) {
    return (
      <EmptyNote
        title={t("Comparação de equipas")}
        text={t("Escolhe uma competição com classificação guardada e duas equipas. O gráfico usa jogos, vitórias, empates, derrotas, golos e pontos dessa tabela.")}
      />
    );
  }
  if (!competitionName || table.length < 2) {
    return (
      <EmptyNote
        title={t("Comparação de equipas")}
        text={t("A classificação atual desta competição ainda não está na base local. Sem essa tabela, a comparação fica em branco.")}
      />
    );
  }

  const left = table.find((team) => String(team.teamExternalId) === teamA);
  const right = table.find((team) => String(team.teamExternalId) === teamB);
  if (!left || !right) {
    return (
      <EmptyNote
        title={t("Comparação de equipas")}
        text={locale === "en-US" ? `The ${competitionName} standings have ${formatLocaleNumber(table.length, locale)} teams. Choose two to view the chart.` : locale === "pt-BR" ? `A classificação de ${competitionName} tem ${formatLocaleNumber(table.length, locale)} times. Escolha dois para ver o gráfico.` : `A classificação de ${competitionName} tem ${formatLocaleNumber(table.length, locale)} equipas. Escolhe duas para ver o gráfico.`}
      />
    );
  }
  if (left.teamExternalId === right.teamExternalId) {
    return (
      <EmptyNote title={t("Comparação de equipas")} text={t("Escolhe duas equipas diferentes da mesma classificação.")} />
    );
  }

  return (
    <Reveal>
    <section className="stat-card border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">{t("Comparação de equipas")}</h2>
      <p className="mt-1 text-sm text-muted">
        {competitionName}. {t("Números da classificação atual:")} {left.teamName} ({formatLocaleNumber(left.played, locale)} {t("jogos")}, {formatLocaleNumber(left.points, locale)} {t("pontos")}) e {right.teamName} ({formatLocaleNumber(right.played, locale)} {t("jogos")}, {formatLocaleNumber(right.points, locale)} {t("pontos")}.)
      </p>
      <div className="mt-5">
        <ComparisonBars
          leftName={left.teamName}
          rightName={right.teamName}
          locale={locale}
          rows={[
            { label: t("Pontos"), left: left.points, right: right.points },
            { label: t("Vitórias"), left: left.won, right: right.won },
            { label: t("Empates"), left: left.draw, right: right.draw },
            { label: t("Derrotas"), left: left.lost, right: right.lost },
            { label: t("Golos marcados"), left: left.goalsFor, right: right.goalsFor },
            { label: t("Golos sofridos"), left: left.goalsAgainst, right: right.goalsAgainst },
          ]}
        />
      </div>
    </section>
    </Reveal>
  );
}

function accuracyPoints(calls: Array<{
  date: string;
  homeName: string;
  awayName: string;
  goalsHome: number;
  goalsAway: number;
  home: number;
  draw: number;
  away: number;
}>, locale: Locale) {
  let hits = 0;
  return [...calls].reverse().map((row, index) => {
    const picked = predictedOutcome(row.home, row.draw, row.away);
    const actual = actualOutcome(row.goalsHome, row.goalsAway);
    if (picked === actual) hits += 1;
    const probability = picked === "home" ? row.home : picked === "draw" ? row.draw : row.away;
    return {
      date: row.date,
      match: `${row.homeName} – ${row.awayName}`,
      score: `${row.goalsHome}–${row.goalsAway}`,
      predicted: translate(locale, outcomeKey[picked]),
      actual: translate(locale, outcomeKey[actual]),
      hit: picked === actual,
      probability,
      rate: (hits / (index + 1)) * 100,
    };
  });
}
