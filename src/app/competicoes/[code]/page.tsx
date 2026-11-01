import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Crest } from "@/components/crest";
import { FormMarks } from "@/components/form-marks";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { currentTimestamp, formatCountry, formatLisbonDate, formatLisbonTime, formatStatus, parseStandingForm } from "@/server/format/pt";
import { syncCompetitionSeason, syncCompetitions, syncStandings } from "@/server/ingest/sync";
import { competitionHasMatches, competitionMatches, competitionRecentForm, competitionTable, getCompetition } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const competition = await getCompetition(code);
  return { title: competition?.name ?? code };
}

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tabela?: string; calendario?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  await syncCompetitions();
  const competition = await getCompetition(code);
  if (!competition) notFound();
  const tableType = query.tabela === "HOME" || query.tabela === "AWAY" ? query.tabela : "TOTAL";
  const fullCalendar = query.calendario === "completo";
  const now = currentTimestamp();
  const range = fullCalendar
    ? undefined
    : { from: new Date(now - 14 * 24 * 60 * 60 * 1000), to: new Date(now + 21 * 24 * 60 * 60 * 1000) };

  const [initialTable, initialFixtures, hasMatches, initialRecentForm] = await Promise.all([
    competitionTable(competition.id, tableType),
    competitionMatches(competition.id, range),
    competitionHasMatches(competition.id),
    competitionRecentForm(competition.id),
  ]);
  let table = initialTable;
  let fixtures = initialFixtures;
  let recentForm = initialRecentForm;

  const refresh = async () => {
    const seasonSync = await syncCompetitionSeason(competition.code);
    const tableSync = await syncStandings(competition.code);
    return seasonSync.message ?? tableSync.message ?? null;
  };

  let syncMessage: string | null = null;
  if (!hasMatches && table.length === 0) {
    syncMessage = await refresh();
    [table, fixtures, recentForm] = await Promise.all([
      competitionTable(competition.id, tableType),
      competitionMatches(competition.id, range),
      competitionRecentForm(competition.id),
    ]);
  } else {
    after(() => {
      void refresh().catch(() => undefined);
    });
  }
  const fetchedAt = table[0]?.fetchedAt;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">{formatCountry(competition.country)}</p>
        <h1 className="font-serif text-4xl">{competition.name}</h1>
      </header>
      {syncMessage ? <p className="text-sm text-live">{syncMessage}</p> : null}
      <nav aria-label="Tipo de tabela" className="flex gap-3 text-sm">
        <TableLink code={competition.code} type="TOTAL" current={tableType} label="Total" />
        <TableLink code={competition.code} type="HOME" current={tableType} label="Casa" />
        <TableLink code={competition.code} type="AWAY" current={tableType} label="Fora" />
      </nav>
      {table.length === 0 ? (
        <p className="text-sm">Classificação: Não disponível.</p>
      ) : (
        <StandingTable competitionName={competition.name} table={table} recentForm={recentForm} />
      )}
      {fetchedAt ? (
        <p className="text-sm text-muted">
          Classificação guardada em {formatLisbonDate(fetchedAt)}. Quando a origem envia a forma, a coluna mantém essa ordem. Sem esse dado, mostra os últimos 5 resultados regulamentares desta competição, do mais antigo ao mais recente.
        </p>
      ) : null}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">Calendário guardado</h2>
          <nav aria-label="Extensão do calendário" className="flex gap-3 text-sm">
            <Link href={`/competicoes/${competition.code}?tabela=${tableType}`} aria-current={fullCalendar ? undefined : "page"} className={fullCalendar ? "text-muted hover:text-foreground" : "font-semibold text-primary underline decoration-primary underline-offset-4"}>
              Próximos
            </Link>
            <Link
              href={`/competicoes/${competition.code}?tabela=${tableType}&calendario=completo`}
              aria-current={fullCalendar ? "page" : undefined}
              className={fullCalendar ? "font-semibold text-primary underline decoration-primary underline-offset-4" : "text-muted hover:text-foreground"}
            >
              Completo
            </Link>
          </nav>
        </div>
        {fixtures.length === 0 ? (
          <p className="mt-3 text-sm">
            {fullCalendar
              ? "Calendário: Não disponível."
              : "Não há jogos guardados nas últimas duas semanas nem nas próximas três. O calendário completo continua disponível."}
          </p>
        ) : null}
        <ul className="mt-3 divide-y divide-row border border-line bg-card">
          {fixtures.map((fixture) => (
            <li key={fixture.externalId} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.25rem] items-center gap-3 px-4 py-3 text-sm">
              <span className="text-muted">
                <span className="block tabular">{formatLisbonDate(fixture.utcDate)}</span>
                <span className="block tabular">{formatLisbonTime(fixture.utcDate)}</span>
              </span>
              <Link href={`/jogos/${fixture.externalId}`} className="min-w-0 leading-5 hover:underline">
                {fixture.homeName} – {fixture.awayName}
              </Link>
              <span className="text-right font-semibold tabular text-primary">
                {fixture.regularHome != null && fixture.regularAway != null
                  ? `${fixture.regularHome}–${fixture.regularAway}`
                  : formatStatus(fixture.status)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const standingColumns = [
  { key: "played", label: "J", title: "Jogos" },
  { key: "won", label: "V", title: "Vitórias" },
  { key: "draw", label: "E", title: "Empates" },
  { key: "lost", label: "D", title: "Derrotas" },
  { key: "goalsFor", label: "GM", title: "Golos marcados" },
  { key: "goalsAgainst", label: "GS", title: "Golos sofridos" },
  { key: "goalDifference", label: "DG", title: "Diferença de golos" },
  { key: "points", label: "Pts", title: "Pontos" },
] as const;

function StandingTable({
  competitionName,
  table,
  recentForm,
}: {
  competitionName: string;
  table: Awaited<ReturnType<typeof competitionTable>>;
  recentForm: Awaited<ReturnType<typeof competitionRecentForm>>;
}) {
  const groups = [...new Set(table.map((row) => row.groupName).filter((name): name is string => Boolean(name)))];
  const showGroups = groups.length > 1;
  const columnCount = standingColumns.length + 3;

  return (
    <div className="overflow-x-auto border border-line bg-card">
      <table className="w-full min-w-[46rem] table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Classificação de {competitionName}</caption>
        <colgroup>
          <col className="w-11" />
          <col />
          {standingColumns.map((column) => (
            <col key={column.key} className="w-10" />
          ))}
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 w-11 bg-raised px-2 py-2 text-center">
              Pos.
            </th>
            <th scope="col" className="sticky left-11 z-20 min-w-52 border-r border-line bg-raised px-3 py-2">
              Equipa
            </th>
            {standingColumns.map((column) => (
              <th key={column.key} scope="col" title={column.title} className="w-10 px-1 py-2 text-center">
                {column.label}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-center">
              Forma
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, index) => {
            const previousGroup = index > 0 ? table[index - 1]?.groupName : null;
            const originForm = parseStandingForm(row.form);
            const marks = originForm.length > 0 ? originForm : (recentForm.get(row.teamExternalId) ?? []);
            const groupHeader =
              showGroups && row.groupName && row.groupName !== previousGroup ? (
                <tr>
                  <th colSpan={columnCount} scope="colgroup" className="border-t border-line px-3 py-2 text-left text-xs normal-case tracking-normal">
                    {row.groupName}
                  </th>
                </tr>
              ) : null;
            return (
              <Fragment key={`${row.groupName}-${row.teamExternalId}`}>
                {groupHeader}
                <tr className="group">
                  <td className="sticky left-0 z-10 bg-[var(--card)] px-2 py-2 text-center align-middle tabular group-hover:bg-raised">
                    {row.position}
                  </td>
                  <td className="sticky left-11 z-10 min-w-52 border-r border-line bg-[var(--card)] px-3 py-2 align-middle group-hover:bg-raised">
                    <Link href={`/equipas/${row.teamExternalId}`} className="inline-flex max-w-full items-center gap-2 whitespace-nowrap hover:underline">
                      <Crest src={row.crestUrl} name={row.teamName} />
                      {row.teamName}
                    </Link>
                  </td>
                  {standingColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`w-10 px-1 py-2 text-center align-middle tabular ${column.key === "points" ? "font-semibold" : ""}`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center align-middle">
                    <FormMarks marks={marks} nowrap />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableLink({
  code,
  type,
  current,
  label,
}: {
  code: string;
  type: string;
  current: string;
  label: string;
}) {
  const active = current === type;
  return (
    <Link
      href={`/competicoes/${code}?tabela=${type}`}
      aria-current={active ? "page" : undefined}
      className={active ? "font-semibold text-primary underline decoration-primary underline-offset-4" : "text-muted underline-offset-4 hover:text-foreground hover:underline"}
    >
      {label}
    </Link>
  );
}
