import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/crest";
import { FormMarks } from "@/components/form-marks";
import { H2HChart } from "@/components/h2h-chart";
import { GrowBar, Reveal } from "@/components/chart-motion";
import { MatchCharts } from "@/components/match-charts";
import { OriginNote } from "@/components/origin-note";
import { ConfidenceRadar } from "@/components/confidence-radar";
import { MatchContext } from "@/components/match-context";
import { ProbabilityPanel } from "@/components/probability-panel";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import {
  formatCountry,
  formatDuration,
  formatLisbonDate,
  formatLisbonDateTime,
  formatNumber,
  formatPercent,
  formatStage,
  formatStatus,
  formatWinner,
} from "@/server/format/pt";
import { predictMatch, type Prediction } from "@/server/model/poisson";
import { syncCompetitionSeason, syncHeadToHead, syncMatch } from "@/server/ingest/sync";
import {
  competitionHistory,
  getMatchBundle,
  headToHeadMatches,
  rememberUpcomingPrediction,
} from "@/server/queries";
import { summarizeH2H } from "@/server/stats/h2h";
import { summarizeTeam, type TeamSampleMatch } from "@/server/stats/team";
import { getLocale } from "@/lib/get-locale";
import { translate, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Search = { n?: string; desde?: string; competicao?: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Jogo ${id}` };
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const { id } = await params;
  const query = await searchParams;
  const externalId = Number(id);
  if (!Number.isInteger(externalId)) notFound();

  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  const matchSync = await syncMatch(externalId);
  const initial = await getMatchBundle(externalId);
  if (!initial) notFound();
  const seasonSync = await syncCompetitionSeason(initial.competition.code);
  const headSync = await syncHeadToHead(externalId);
  const syncMessage = matchSync.message ?? seasonSync.message ?? headSync.message;
  const bundle = await getMatchBundle(externalId);
  if (!bundle) notFound();

  const history = await competitionHistory(bundle.competition.id);
  const goalHistory = history.flatMap((match) => {
    if (match.regularHome == null || match.regularAway == null) return [];
    return [
      {
        utcDate: match.utcDate.toISOString(),
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeGoals: match.regularHome,
        awayGoals: match.regularAway,
      },
    ];
  });
  const calculated = predictMatch({
    homeTeamId: bundle.match.homeTeamId,
    awayTeamId: bundle.match.awayTeamId,
    kickoff: bundle.match.utcDate.toISOString(),
    history: goalHistory,
  });
  const recording = await rememberUpcomingPrediction(bundle.match.utcDate, bundle.match.id, calculated);
  const stored = recording.stored;
  const storedPayload = stored?.payload as Prediction | undefined;
  const result = storedPayload?.version ? storedPayload : calculated;
  const recordedAt = stored?.createdAt ?? null;

  const homeSamples = samplesBefore(history, bundle.match.homeTeamId, bundle.match.utcDate);
  const awaySamples = samplesBefore(history, bundle.match.awayTeamId, bundle.match.utcDate);
  const homeSummary = summarizeTeam(homeSamples);
  const awaySummary = summarizeTeam(awaySamples);

  const limit = query.n === "5" || query.n === "10" ? Number(query.n) : undefined;
  const sinceYear = /^\d{4}$/.test(query.desde ?? "") ? Number(query.desde) : undefined;
  const h2h = summarizeH2H(
    (await headToHeadMatches(bundle.match.homeTeamId, bundle.match.awayTeamId))
      .filter((match) => new Date(match.utcDate).getTime() < bundle.match.utcDate.getTime())
      .map((match) => ({
        ...match,
        utcDate: match.utcDate.toISOString(),
      })),
    {
      teamA: bundle.match.homeTeamId,
      teamB: bundle.match.awayTeamId,
      competitionCode: query.competicao || undefined,
      sinceYear,
      limit,
      referenceDate: bundle.match.utcDate.toISOString(),
    },
  );

  return (
    <div className="space-y-6">
      <header className="border border-line bg-card p-5">
        <p className="text-sm text-muted">
          <Link href={`/competicoes/${bundle.competition.code}`} className="hover:underline">
            {bundle.competition.name}
          </Link>
          {" · "}
          {formatCountry(bundle.competition.country)}
          {" · "}
          {formatStage(bundle.match.stage)}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamHeading name={bundle.home.name} crest={bundle.home.crestUrl} href={`/equipas/${bundle.home.externalId}`} />
          <p className="tabular text-center text-3xl text-primary">
            {bundle.match.regularHome != null && bundle.match.regularAway != null
              ? `${bundle.match.regularHome}–${bundle.match.regularAway}`
              : formatLisbonDateTime(bundle.match.utcDate).split(", ")[1]}
          </p>
          <TeamHeading name={bundle.away.name} crest={bundle.away.crestUrl} href={`/equipas/${bundle.away.externalId}`} align="end" />
        </div>
        <p className="mt-4 text-sm">
          {formatStatus(bundle.match.status)} · {formatLisbonDateTime(bundle.match.utcDate)} ·{" "}
          {bundle.match.venue ?? "Recinto não disponível"}
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Fact label="Intervalo" home={bundle.match.htHome} away={bundle.match.htAway} />
          <Fact label="Tempo regulamentar" home={bundle.match.regularHome} away={bundle.match.regularAway} />
          <Fact label="Prolongamento indicado pela origem" home={bundle.match.etHome} away={bundle.match.etAway} />
          <Fact label="Penáltis" home={bundle.match.penHome} away={bundle.match.penAway} />
        </dl>
        <p className="mt-3 text-sm text-muted">
          Duração indicada pela origem: {formatDuration(bundle.match.duration)}. O vencedor oficial da origem, que pode incluir prolongamento ou penáltis, é {formatWinner(bundle.match.winner)}.
        </p>
        <div className="mt-3">
          <OriginNote fetchedAt={bundle.match.fetchedAt} remoteUpdatedAt={bundle.match.remoteUpdatedAt} delayed />
        </div>
      </header>
      {syncMessage ? <p className="text-sm text-live">{syncMessage}</p> : null}

      <MatchContext names={[bundle.home.name, bundle.away.name, bundle.competition.name]} />
      <ConfidenceRadar result={result} />
      <ProbabilityPanel result={result} recordedAt={recordedAt} retrospective={recording.retrospective} />
      <MatchCharts homeName={bundle.home.name} awayName={bundle.away.name} homeMatches={homeSamples} awayMatches={awaySamples} />

      <Reveal>
      <section className="stat-card border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">{locale === "en-US" ? "Game statistics" : locale === "pt-BR" ? "Estatísticas da partida" : "Estatísticas do jogo"}</h2>
        <StatCompare
          locale={locale}
          rows={[
            [t("Remates"), bundle.match.homeShots, bundle.match.awayShots],
            [t("Remates à baliza"), bundle.match.homeShotsOn, bundle.match.awayShotsOn],
            [`${t("Posse de bola")} (%)`, bundle.match.homePossession, bundle.match.awayPossession],
            [t("Pontapés de canto"), bundle.match.homeCorners, bundle.match.awayCorners],
            [t("Faltas"), bundle.match.homeFouls, bundle.match.awayFouls],
            [t("Cartões amarelos"), bundle.match.homeYellow, bundle.match.awayYellow],
            [t("Cartões vermelhos"), bundle.match.homeRed, bundle.match.awayRed],
          ]}
        />
        <p className="mt-3 text-sm text-muted">{locale === "en-US" ? "Expected goals and expected goals allowed: Unavailable." : locale === "pt-BR" ? "Gols esperados e gols esperados sofridos: Indisponíveis." : "Golos esperados e golos esperados sofridos: Não disponíveis."}</p>
        <p className="text-sm text-muted">{locale === "en-US" ? "Lineups, injuries, and suspensions: Unavailable unless listed on the team page." : locale === "pt-BR" ? "Escalações, lesões e suspensões: indisponíveis, exceto se constarem na página do time." : "Onze inicial, lesões e suspensões: não disponíveis, salvo se constarem na página da equipa."}</p>
      </section>
      </Reveal>

      <section className="grid gap-4 md:grid-cols-2">
        <TeamForm title={bundle.home.name} summary={homeSummary} />
        <TeamForm title={bundle.away.name} summary={awaySummary} />
      </section>

      <SampleCompare homeName={bundle.home.name} awayName={bundle.away.name} home={homeSummary} away={awaySummary} />

      <section className="stat-card border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Confrontos diretos</h2>
        <p className="mt-2 text-sm text-muted">
          Contas no tempo regulamentar. Prolongamento e penáltis ficam separados e não entram como vitória regulamentar.
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-4" method="get">
          <label className="text-sm">
            Número de jogos
            <select className="mt-1 w-full rounded-md border border-line bg-raised px-2 py-2" name="n" defaultValue={query.n ?? ""}>
              <option value="">Todos os encontrados</option>
              <option value="5">Últimos 5</option>
              <option value="10">Últimos 10</option>
            </select>
          </label>
          <label className="text-sm">
            Desde o ano
            <input className="mt-1 w-full rounded-md border border-line bg-raised px-2 py-2" name="desde" defaultValue={query.desde ?? ""} inputMode="numeric" />
          </label>
          <label className="text-sm">
            Competição
            <input className="mt-1 w-full rounded-md border border-line bg-raised px-2 py-2" name="competicao" defaultValue={query.competicao ?? ""} placeholder="Código" />
          </label>
          <div className="flex items-end">
            <button className="btn w-full" type="submit">
              Filtrar
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm">
          Encontrados: {h2h.found}. Usados com resultado regulamentar: {h2h.used}. Sem resultado regulamentar: {h2h.excludedWithoutRegulation}.
        </p>
        {h2h.lowSample ? (
          <p className="mt-2 text-sm text-live">Amostra reduzida: menos de 5 confrontos com resultado regulamentar.</p>
        ) : null}
        {h2h.used > 0 ? (
          <H2HChart
            homeName={bundle.home.name}
            awayName={bundle.away.name}
            winsHome={h2h.winsA}
            draws={h2h.draws}
            winsAway={h2h.winsB}
            points={[...h2h.matches].reverse().flatMap((match) => {
              if (match.regularHome == null || match.regularAway == null) return [];
              const homeIsA = match.homeTeamId === bundle.match.homeTeamId;
              return [{
                date: match.utcDate,
                competition: match.competitionName,
                score: `${match.regularHome}–${match.regularAway}`,
                goalsHome: homeIsA ? match.regularHome : match.regularAway,
                goalsAway: homeIsA ? match.regularAway : match.regularHome,
              }];
            })}
          />
        ) : null}
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <Mini label={`Vitórias de ${bundle.home.shortName ?? bundle.home.name}`} value={String(h2h.winsA)} />
          <Mini label="Empates" value={String(h2h.draws)} />
          <Mini label={`Vitórias de ${bundle.away.shortName ?? bundle.away.name}`} value={String(h2h.winsB)} />
          <Mini label="Golos da casa histórica" value={String(h2h.goalsA)} />
          <Mini label="Golos da visita histórica" value={String(h2h.goalsB)} />
          <Mini label="Média de golos" value={formatNumber(h2h.goalsPerMatch)} />
          <Mini label="Mais de 1,5" value={formatPercent(h2h.over15)} />
          <Mini label="Mais de 2,5" value={formatPercent(h2h.over25)} />
          <Mini label="Ambas marcaram" value={formatPercent(h2h.bothScored)} />
          <Mini label="Vitórias de quem jogou em casa" value={String(h2h.homeWins)} />
          <Mini label="Vitórias de quem jogou fora" value={String(h2h.awayWins)} />
          <Mini label="Empates no recinto" value={String(h2h.venueDraws)} />
          <Mini label="Jogos com prolongamento" value={String(h2h.extraTime)} />
          <Mini label="Desempates por penáltis" value={String(h2h.penalties)} />
          <Mini label="Parte ponderada de vitórias da casa" value={formatPercent(h2h.weightedWinShareA)} />
        </dl>
        <p className="mt-3 text-sm text-muted">
          A parte ponderada usa meia-vida de 3 anos e é só descritiva. Não é a probabilidade do próximo jogo e não entra no modelo.
        </p>
        <ul className="mt-4 divide-y divide-row text-sm">
          {h2h.matches.length === 0 ? <li className="py-2">Não há confrontos diretos na base para este filtro.</li> : null}
          {h2h.matches.map((match) => (
            <li key={h2hKey(match)} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{formatLisbonDate(match.utcDate)}{match.source === "openfootball" ? " · histórico" : ""}</span>
              <span>{match.competitionName}</span>
              <span className="tabular">
                {match.regularHome ?? "–"}–{match.regularAway ?? "–"}
                {match.duration === "PENALTY_SHOOTOUT" ? " · penáltis" : ""}
                {match.duration === "EXTRA_TIME" ? " · prolongamento" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {bundle.match.oddsHome != null && bundle.match.oddsDraw != null && bundle.match.oddsAway != null ? (
        <section className="border border-line bg-card p-5 text-sm leading-6">
          <h2 className="font-serif text-2xl">Cotação agregada</h2>
          <p className="mt-2">
            Casa {formatNumber(bundle.match.oddsHome)}, empate {formatNumber(bundle.match.oddsDraw)}, visita {formatNumber(bundle.match.oddsAway)}.
            Isto não é uma comparação de casas de apostas nem uma recomendação.
          </p>
        </section>
      ) : (
        <p className="text-sm text-muted">Cotações de várias casas: Não disponível. Não há uma fonte de cotações configurada.</p>
      )}
    </div>
  );
}

function h2hKey(match: {
  utcDate: string;
  competitionCode: string;
  homeTeamId: number;
  awayTeamId: number;
  externalId?: number;
  source?: string;
}) {
  if (match.source && match.externalId != null) return `${match.source}-${match.externalId}`;
  return `${match.utcDate}-${match.competitionCode}-${match.homeTeamId}-${match.awayTeamId}`;
}

function samplesBefore(
  history: Awaited<ReturnType<typeof competitionHistory>>,
  teamId: number,
  kickoff: Date,
): TeamSampleMatch[] {
  return history.flatMap((match) => {
    if (match.utcDate >= kickoff || match.regularHome == null || match.regularAway == null) return [];
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) return [];
    const venue = match.homeTeamId === teamId ? "home" : "away";
    return [
      {
        utcDate: match.utcDate.toISOString(),
        venue,
        goalsFor: venue === "home" ? match.regularHome : match.regularAway,
        goalsAgainst: venue === "home" ? match.regularAway : match.regularHome,
      },
    ];
  });
}

function TeamHeading({
  name,
  crest,
  href,
  align = "start",
}: {
  name: string;
  crest: string | null;
  href: string;
  align?: "start" | "end";
}) {
  return (
    <Link href={href} className={`flex items-center gap-3 hover:underline ${align === "end" ? "sm:flex-row-reverse sm:text-right" : ""}`}>
      <Crest src={crest} name={name} />
      <span className="font-serif text-2xl">{name}</span>
    </Link>
  );
}

function Fact({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{home == null || away == null ? "Não disponível" : `${home}–${away}`}</dd>
    </div>
  );
}

function StatCompare({ rows, locale }: { rows: Array<[string, number | null, number | null]>; locale: Locale }) {
  const t = (text: string) => translate(locale, text);
  return (
    <table className="mt-4 w-full text-left text-sm">
      <caption className="sr-only">{locale === "en-US" ? "Statistics for both teams" : locale === "pt-BR" ? "Estatísticas dos dois times" : "Estatísticas das duas equipas"}</caption>
      <thead>
        <tr className="text-muted">
          <th className="py-1 font-medium">{locale === "en-US" ? "Home" : locale === "pt-BR" ? "Mandante" : "Casa"}</th>
          <th className="py-1 font-medium">{locale === "en-US" ? "Stat" : locale === "pt-BR" ? "Indicador" : "Indicador"}</th>
          <th className="py-1 text-right font-medium">{locale === "en-US" ? "Away" : locale === "pt-BR" ? "Visitante" : "Visita"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, home, away]) => {
          const total = home != null && away != null ? home + away : null;
          const homeShare = total != null && total > 0 ? (home! / total) * 100 : null;
          return (
            <tr key={label} className="border-t border-line">
              <td className="tabular py-2">{home ?? t("Não disponível")}</td>
              <td className="py-2">
                <span>{label}</span>
                {homeShare != null ? (
                  <span className="mt-1 block">
                    <GrowBar value={homeShare} max={100} tone="primary" tip={locale === "en-US" ? `${label}: home team has ${homeShare.toLocaleString(locale, { maximumFractionDigits: 1 })}% of both teams' total` : locale === "pt-BR" ? `${label}: o mandante tem ${homeShare.toLocaleString(locale, { maximumFractionDigits: 1 })}% do total dos dois times` : `${label}: a equipa da casa tem ${homeShare.toLocaleString(locale, { maximumFractionDigits: 1 })}% do total das duas equipas`} />
                  </span>
                ) : null}
              </td>
              <td className="tabular py-2 text-right">{away ?? t("Não disponível")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TeamForm({ title, summary }: { title: string; summary: ReturnType<typeof summarizeTeam> }) {
  return (
    <section className="stat-card border border-line bg-card p-5 text-sm">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-1 text-muted">Forma na competição, só com jogos anteriores a este encontro. Amostra: {summary.played}.</p>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        Últimos 5, mais recente à esquerda: <FormMarks marks={summary.form5} />
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        Últimos 10, mais recente à esquerda: <FormMarks marks={summary.form10} />
      </p>
      <p className="mt-3">Sequência de resultados: {textoResultado(summary)}.</p>
      <p>Sequência de golos: {textoGolos(summary)}. Estas sequências descrevem jogos já disputados.</p>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Vitórias" value={String(summary.won)} />
        <Mini label="Empates" value={String(summary.draw)} />
        <Mini label="Derrotas" value={String(summary.lost)} />
        <Mini label="Golos marcados" value={String(summary.goalsFor)} />
        <Mini label="Golos sofridos" value={String(summary.goalsAgainst)} />
        <Mini label="Amostra" value={String(summary.played)} />
      </dl>
      <p className="mt-3">
        Percentagem de vitórias nesta amostra: {formatPercent(summary.winRate)}. Isto não é a probabilidade do próximo jogo. Média de golos marcados: {formatNumber(summary.goalsPerGame)}. Média de golos sofridos: {formatNumber(summary.concededPerGame)}.
      </p>
      <p>
        Diferença de golos: {summary.goalDifference > 0 ? `+${summary.goalDifference}` : summary.goalDifference}. Pontos por jogo: {formatNumber(summary.pointsPerGame)}. Mais de 1,5 golos: {formatPercent(summary.over15)}. Mais de 2,5: {formatPercent(summary.over25)}. Mais de 3,5: {formatPercent(summary.over35)}. Ambas marcaram: {formatPercent(summary.bothScored)}. Amostra: {summary.played}. Estas contas descrevem jogos já disputados.
      </p>
      <p>
        Em casa ({conta(summary.home.played, "jogo", "jogos")}): {conta(summary.home.won, "vitória", "vitórias")}, {conta(summary.home.draw, "empate", "empates")}, {conta(summary.home.lost, "derrota", "derrotas")}, {conta(summary.home.goalsFor, "golo marcado", "golos marcados")} e {conta(summary.home.goalsAgainst, "sofrido", "sofridos")}.
      </p>
      <p>
        Fora ({conta(summary.away.played, "jogo", "jogos")}): {conta(summary.away.won, "vitória", "vitórias")}, {conta(summary.away.draw, "empate", "empates")}, {conta(summary.away.lost, "derrota", "derrotas")}, {conta(summary.away.goalsFor, "golo marcado", "golos marcados")} e {conta(summary.away.goalsAgainst, "sofrido", "sofridos")}.
      </p>
    </section>
  );
}

function conta(total: number, singular: string, plural: string) {
  return `${total} ${total === 1 ? singular : plural}`;
}

function textoResultado(summary: ReturnType<typeof summarizeTeam>) {
  const streak = summary.streaks.result;
  if (!streak) return "Não disponível";
  if (streak.mark === "V") return conta(streak.length, "vitória", "vitórias");
  if (streak.mark === "E") return conta(streak.length, "empate", "empates");
  return conta(streak.length, "derrota", "derrotas");
}

function textoGolos(summary: ReturnType<typeof summarizeTeam>) {
  const streak = summary.streaks.goals;
  if (!streak) return "Não disponível";
  const jogos = conta(streak.length, "jogo seguido", "jogos seguidos");
  return streak.kind === "over25" ? `${jogos} com mais de 2,5 golos` : `${jogos} com 2,5 golos ou menos`;
}

function SampleCompare({
  homeName,
  awayName,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  home: ReturnType<typeof summarizeTeam>;
  away: ReturnType<typeof summarizeTeam>;
}) {
  const rows: Array<[string, string, string]> = [
    ["Amostra", String(home.played), String(away.played)],
    ["Vitórias, empates e derrotas", `${home.won}-${home.draw}-${home.lost}`, `${away.won}-${away.draw}-${away.lost}`],
    ["Pontos por jogo", formatNumber(home.pointsPerGame), formatNumber(away.pointsPerGame)],
    ["Golos marcados por jogo", formatNumber(home.goalsPerGame), formatNumber(away.goalsPerGame)],
    ["Golos sofridos por jogo", formatNumber(home.concededPerGame), formatNumber(away.concededPerGame)],
    ["Mais de 2,5 golos", formatPercent(home.over25), formatPercent(away.over25)],
    ["Ambas marcaram", formatPercent(home.bothScored), formatPercent(away.bothScored)],
    ["Sequência de resultados", textoResultado(home), textoResultado(away)],
    ["Sequência de golos", textoGolos(home), textoGolos(away)],
  ];

  return (
    <section className="stat-card border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Comparação das amostras</h2>
      <p className="mt-2 text-sm text-muted">
        Jogos anteriores desta competição, antes deste encontro. As percentagens descrevem o que já aconteceu e não são a probabilidade do próximo jogo.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Comparação entre {homeName} e {awayName}</caption>
          <thead className="text-muted">
            <tr>
              <th className="py-2 font-medium">Indicador</th>
              <th className="py-2 font-medium">{homeName}</th>
              <th className="py-2 text-right font-medium">{awayName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, homeValue, awayValue]) => (
              <tr key={label} className="border-t border-row">
                <th className="py-2 pr-3 font-normal" scope="row">{label}</th>
                <td className="tabular py-2">{homeValue}</td>
                <td className="tabular py-2 text-right">{awayValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-raised px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
