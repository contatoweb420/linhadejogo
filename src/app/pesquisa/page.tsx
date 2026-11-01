import Link from "next/link";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { formatCountry } from "@/server/format/pt";
import { searchCatalog } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pesquisa" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const term = (params.q ?? "").trim();
  const database = await pingDatabase();

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Pesquisa</h1>
      <form className="flex gap-2" method="get">
        <label className="sr-only" htmlFor="q">
          Equipa ou competição
        </label>
        <input
          id="q"
          name="q"
          defaultValue={term}
          placeholder="Equipa ou competição"
          className="field"
        />
        <button className="btn" type="submit">
          Procurar
        </button>
      </form>
      {!database ? <SetupPanel database={database} /> : null}
      {database && term.length >= 2 ? <Results term={term} /> : null}
      {database && term.length > 0 && term.length < 2 ? (
        <p className="text-sm">Escreve pelo menos duas letras.</p>
      ) : null}
    </div>
  );
}

async function Results({ term }: { term: string }) {
  const result = await searchCatalog(term);
  if (result.teams.length === 0 && result.competitions.length === 0) {
    return <p className="text-sm">Nenhum resultado na base local. Atualiza os jogos do dia ou abre uma competição para a preencher.</p>;
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h2 className="font-serif text-2xl">Equipas</h2>
        <ul className="mt-3 divide-y divide-row border border-line">
          {result.teams.map((team) => (
            <li key={team.id} className="px-4 py-3">
              <Link href={`/equipas/${team.externalId}`} className="hover:underline">
                {team.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl">Competições</h2>
        <ul className="mt-3 divide-y divide-row border border-line">
          {result.competitions.map((competition) => (
            <li key={competition.id} className="px-4 py-3">
              <Link href={`/competicoes/${competition.code}`} className="hover:underline">
                {competition.name}
              </Link>
              <span className="text-muted"> · {formatCountry(competition.country)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
