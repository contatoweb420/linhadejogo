import Link from "next/link";
import { MatchCard, type MatchCardData } from "@/components/match-card";
import { formatCountry, matchGroup } from "@/server/format/pt";

const sections = [
  { id: "live", title: "A decorrer" },
  { id: "upcoming", title: "Por começar" },
  { id: "finished", title: "Terminados" },
  { id: "other", title: "Adiados, suspensos ou cancelados" },
] as const;

export function MatchBoard({ matches }: { matches: MatchCardData[] }) {
  const counts = {
    live: matches.filter((match) => matchGroup(match.status) === "live").length,
    upcoming: matches.filter((match) => matchGroup(match.status) === "upcoming").length,
    finished: matches.filter((match) => matchGroup(match.status) === "finished").length,
    other: matches.filter((match) => matchGroup(match.status) === "other").length,
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-px bg-row sm:grid-cols-4">
        <Count label="A decorrer" value={counts.live} />
        <Count label="Por começar" value={counts.upcoming} />
        <Count label="Terminados" value={counts.finished} />
        <Count label="Adiados ou cancelados" value={counts.other} />
      </div>
      {sections.map((section) => {
        const rows = matches.filter((match) => matchGroup(match.status) === section.id);
        if (rows.length === 0) return null;
        return (
          <section key={section.id} className="space-y-4">
            <h2 className="font-serif text-2xl uppercase tracking-wide text-forest">
              {section.title} <span className="text-base text-muted">{rows.length}</span>
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {groupByCompetition(rows).map((group) => (
                <section key={group.code} className="border border-line bg-card">
                  <h3 className="flex items-baseline justify-between gap-3 border-b border-row bg-raised px-4 py-3 text-xs uppercase tracking-[0.14em]">
                    <Link href={`/competicoes/${group.code}`} className="text-forest hover:underline">
                      {group.name}
                    </Link>
                    <span className="text-muted">{formatCountry(group.country)}</span>
                  </h3>
                  <div className="divide-y divide-row px-4">
                    {group.items.map((match) => (
                      <MatchCard key={match.externalId} match={match} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <p className="bg-surface px-4 py-3">
      <span className="block text-xs uppercase tracking-[0.12em] text-muted">{label}</span>
      <span className="font-serif text-3xl text-forest">{value}</span>
    </p>
  );
}

function groupByCompetition(matches: MatchCardData[]) {
  const groups = new Map<string, { code: string; name: string; country: string | null; items: MatchCardData[] }>();
  for (const match of matches) {
    const current = groups.get(match.competitionCode) ?? {
      code: match.competitionCode,
      name: match.competitionName,
      country: match.country,
      items: [],
    };
    current.items.push(match);
    groups.set(match.competitionCode, current);
  }
  return [...groups.values()];
}
