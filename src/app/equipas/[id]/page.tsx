import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/crest";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { formatLisbonDate, formatNumber, formatPercent, formatPosition } from "@/server/format/pt";
import { syncTeam } from "@/server/ingest/sync";
import { getTeamByExternalId, teamMatches, teamSquad, teamStandings } from "@/server/queries";
import { seasonSummaries, summarizeTeam, type TeamSampleMatch } from "@/server/stats/team";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Equipa ${id}` };
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const externalId = Number(id);
  if (!Number.isInteger(externalId)) notFound();
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  const teamSync = await syncTeam(externalId);
  const team = await getTeamByExternalId(externalId);
  if (!team) notFound();

  const [rows, table, squad] = await Promise.all([
    teamMatches(team.id),
    teamStandings(team.id),
    teamSquad(team.id),
  ]);
  const finished = rows.flatMap((row) => {
    if (row.status !== "FINISHED" || row.regularHome == null || row.regularAway == null) return [];
    const venue = row.homeTeamId === team.id ? "home" : "away";
    const sample: TeamSampleMatch = {
      utcDate: row.utcDate.toISOString(),
      venue,
      goalsFor: venue === "home" ? row.regularHome : row.regularAway,
      goalsAgainst: venue === "home" ? row.regularAway : row.regularHome,
    };
    return [{ ...sample, season: row.seasonStart?.slice(0, 4) ?? "Sem época", source: row.source, shotsFor: venue === "home" ? row.homeShots : row.awayShots, shotsOn: venue === "home" ? row.homeShotsOn : row.awayShotsOn, possession: venue === "home" ? row.homePossession : row.awayPossession, corners: venue === "home" ? row.homeCorners : row.awayCorners, yellow: venue === "home" ? row.homeYellow : row.awayYellow, red: venue === "home" ? row.homeRed : row.awayRed }];
  });
  const summary = summarizeTeam(finished);
  const bySeason = seasonSummaries(finished).filter((season) => season.season !== "Sem época");
  const historical = finished.filter((match) => match.source === "openfootball").length;
  const shotSample = average(finished.map((match) => match.shotsFor));
  const shotOnSample = average(finished.map((match) => match.shotsOn));
  const possessionSample = average(finished.map((match) => match.possession));
  const cornerSample = average(finished.map((match) => match.corners));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Crest src={team.crestUrl} name={team.name} />
        <div>
          <h1 className="font-serif text-4xl">{team.name}</h1>
          <p className="text-sm text-muted">{team.tla ?? "Sigla não disponível"}</p>
        </div>
      </header>
      {teamSync.message ? <p className="text-sm text-live">{teamSync.message}</p> : null}
      <section className="border border-line bg-card p-5 text-sm leading-6">
        <h2 className="font-serif text-2xl">Resultados guardados</h2>
        <p>Jogos com resultado regulamentar: {summary.played}.</p>
        <p>Vitórias {summary.won}, empates {summary.draw}, derrotas {summary.lost}.</p>
        <p>Percentagem de vitórias nesta amostra: {formatPercent(summary.winRate)}. Não é a probabilidade de ganhar o próximo jogo.</p>
        <p>Golos marcados {summary.goalsFor}. Golos sofridos {summary.goalsAgainst}. Diferença de golos: {signed(summary.goalDifference)}.</p>
        <p>Pontos nesta amostra: {summary.points}. Pontos por jogo: {formatNumber(summary.pointsPerGame)}.</p>
        <p>Média de golos marcados: {formatNumber(summary.goalsPerGame)}. Média de golos sofridos: {formatNumber(summary.concededPerGame)}.</p>
        <p>Mais de 1,5 golos: {formatPercent(summary.over15)}. Mais de 2,5: {formatPercent(summary.over25)}. Mais de 3,5: {formatPercent(summary.over35)}. Ambas marcaram: {formatPercent(summary.bothScored)}. Amostra: {summary.played} jogos. Estas percentagens descrevem o que já aconteceu. Não são a probabilidade do próximo jogo.</p>
        <p>Jogos sem sofrer golos: {summary.cleanSheets}. Jogos em que marcou: {summary.scoredIn}. Jogos em que não marcou: {summary.failedToScore}.</p>
        <p>Em casa ({summary.home.played}): {summary.home.won} vitórias, {summary.home.draw} empates, {summary.home.lost} derrotas, {summary.home.goalsFor} golos marcados e {summary.home.goalsAgainst} sofridos.</p>
        <p>Fora ({summary.away.played}): {summary.away.won} vitórias, {summary.away.draw} empates, {summary.away.lost} derrotas, {summary.away.goalsFor} golos marcados e {summary.away.goalsAgainst} sofridos.</p>
        <p>Forma nos últimos 5: {summary.form5.join(" ") || "Não disponível"}.</p>
        <p>Forma nos últimos 10: {summary.form10.join(" ") || "Não disponível"}.</p>
        <p>Jogos da origem em direto: {finished.length - historical}. Jogos históricos OpenFootball: {historical}. O histórico é domínio público e não substitui o resultado em direto. Um jogo que já exista na origem em direto não entra outra vez.</p>
        {bySeason.length < 2 ? <p>Comparação com épocas anteriores: Não disponível. A base ainda não tem mais do que uma época para esta equipa.</p> : (
          <ul>
            {bySeason.map((season) => (
              <li key={season.season}>
                {season.season}: {conta(season.played, "jogo", "jogos")}, {conta(season.won, "vitória", "vitórias")}, {conta(season.draw, "empate", "empates")}, {conta(season.lost, "derrota", "derrotas")}, diferença {signed(season.goalDifference)}, {formatNumber(season.pointsPerGame)} pontos por jogo.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-line bg-card p-5 text-sm leading-6">
        <h2 className="font-serif text-2xl">Classificação</h2>
        {table.length === 0 ? <p>Não disponível.</p> : null}
        <ul>
          {table.map((row) => (
            <li key={row.competitionCode}>
              <Link className="hover:underline" href={`/competicoes/${row.competitionCode}`}>
                {row.competitionName}
              </Link>
              : {row.position}.º lugar, {row.points} pontos em {row.played} jogos. Tabela recolhida em {formatLisbonDate(row.fetchedAt)}.
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-line bg-card p-5 text-sm leading-6">
        <h2 className="font-serif text-2xl">Indicadores de jogo</h2>
        <p>Remates: {shotSample ? `${formatNumber(shotSample.mean)} por jogo em ${shotSample.count} jogos` : "Não disponível"}.</p>
        <p>Remates à baliza: {shotOnSample ? `${formatNumber(shotOnSample.mean)} por jogo em ${shotOnSample.count} jogos` : "Não disponível"}.</p>
        <p>Posse de bola: {possessionSample ? `${formatNumber(possessionSample.mean)} % em ${possessionSample.count} jogos` : "Não disponível"}.</p>
        <p>Cantos: {cornerSample ? `${formatNumber(cornerSample.mean)} por jogo em ${cornerSample.count} jogos` : "Não disponível"}.</p>
        <p>Golos esperados e golos esperados sofridos: Não disponível.</p>
      </section>

      <section className="border border-line bg-card p-5 text-sm leading-6">
        <h2 className="font-serif text-2xl">Plantel</h2>
        {squad.length === 0 ? (
          <p>Não disponível. A origem dos dados não incluiu jogadores. Também faltam minutos, golos, lesões, suspensões e valor de mercado, por isso não há índice de qualidade do plantel.</p>
        ) : (
          <>
            <p>O índice comparativo de qualidade não é calculado. Faltam minutos, participação em golos, disponibilidade e valor de mercado licenciado. A lista abaixo é só a que a origem devolveu em {formatLisbonDate(squad[0].fetchedAt)}.</p>
            <ul className="mt-3 divide-y divide-row">
              {squad.map((player) => (
                <li key={player.name} className="flex justify-between gap-3 py-2">
                  <span>{player.shirtNumber ?? "–"} {player.name}</span>
                  <span className="text-muted">{formatPosition(player.position)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="font-serif text-2xl">Jogos guardados</h2>
        <ul className="mt-3 divide-y divide-row text-sm">
          {rows.slice(0, 20).map((row) => (
            <li key={`${row.source}-${row.externalId}`} className="flex flex-wrap justify-between gap-2 py-2">
              {row.source === "football-data.org" ? (
                <Link href={`/jogos/${row.externalId}`} className="hover:underline">
                  {formatLisbonDate(row.utcDate)} · {row.competitionName}
                </Link>
              ) : (
                <span>{formatLisbonDate(row.utcDate)} · {row.competitionName} · histórico OpenFootball</span>
              )}
              <span className="tabular">
                {row.regularHome ?? "–"}–{row.regularAway ?? "–"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function conta(total: number, singular: string, plural: string) {
  return `${total} ${total === 1 ? singular : plural}`;
}

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return { mean: present.reduce((sum, value) => sum + value, 0) / present.length, count: present.length };
}
