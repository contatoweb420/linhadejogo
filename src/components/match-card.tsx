import Link from "next/link";
import { Crest } from "@/components/crest";
import { formatLisbonTime, formatOneDecimalPercent, formatStatus, isLiveStatus, matchGroup } from "@/server/format/pt";
import type { ShareEstimate } from "@/server/estimates";

export type MatchCardData = {
  externalId: number;
  utcDate: Date | string;
  status: string;
  minute: number | null;
  duration: string | null;
  regularHome: number | null;
  regularAway: number | null;
  penHome: number | null;
  penAway: number | null;
  competitionCode: string;
  competitionName: string;
  country: string | null;
  homeName: string;
  homeCrest: string | null;
  awayName: string;
  awayCrest: string | null;
  estimate?: ShareEstimate | null;
};

export function MatchCard({ match }: { match: MatchCardData }) {
  const live = isLiveStatus(match.status);
  const score =
    match.regularHome != null && match.regularAway != null
      ? `${match.regularHome}–${match.regularAway}`
      : null;

  const status = [
    formatStatus(match.status),
    live && match.minute != null ? `${match.minute}'` : null,
    match.penHome != null && match.penAway != null ? `Penáltis ${match.penHome}–${match.penAway}` : null,
    match.duration === "EXTRA_TIME" ? "Houve prolongamento" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="py-3">
      <Link href={`/jogos/${match.externalId}`} className="grid items-center gap-3 sm:grid-cols-[1fr_7rem_1fr]">
        <TeamLine name={match.homeName} crest={match.homeCrest} />
        <div className="text-left sm:text-center">
          <p className="font-serif tabular text-3xl leading-none text-primary">{score ?? formatLisbonTime(match.utcDate)}</p>
          <p className={`match-status match-status--${matchGroup(match.status)} mt-1 text-xs uppercase tracking-wide ${live ? "font-semibold" : ""}`}>
            {live ? <span className="live-dot" aria-hidden="true" /> : null}
            {status}
          </p>
        </div>
        <TeamLine name={match.awayName} crest={match.awayCrest} align="end" />
      </Link>
      <EstimateLine estimate={match.estimate} />
    </article>
  );
}

function EstimateLine({ estimate }: { estimate?: ShareEstimate | null }) {
  if (estimate === undefined) return null;
  if (estimate === null) {
    return <p className="mt-1 text-xs text-muted">Estimativa indisponível: faltam jogos anteriores nesta competição.</p>;
  }
  return (
    <p className="mt-1 text-xs text-muted">
      Estimativa, não é uma certeza: casa {formatOneDecimalPercent(estimate.home)}, empate {formatOneDecimalPercent(estimate.draw)}, visita{" "}
      {formatOneDecimalPercent(estimate.away)}.
    </p>
  );
}

function TeamLine({ name, crest, align = "start" }: { name: string; crest: string | null; align?: "start" | "end" }) {
  return (
    <p className={`flex items-center gap-3 ${align === "end" ? "sm:flex-row-reverse sm:text-right" : ""}`}>
      <Crest src={crest} name={name} />
      <span className="font-medium">{name}</span>
    </p>
  );
}
