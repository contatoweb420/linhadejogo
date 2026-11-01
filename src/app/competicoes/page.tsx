import { CompetitionLink } from "@/components/competition-link";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { formatCountry } from "@/server/format/pt";
import { syncCompetitions } from "@/server/ingest/sync";
import { listCompetitions } from "@/server/queries";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export const metadata = { title: "Competições", description: "Explore competições de futebol, classificações e calendários disponíveis na Linha de Jogo." };

export default async function CompetitionsPage() {
  const locale = await getLocale();
  const t = (text: string) => translate(locale, text);
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;
  const sync = await syncCompetitions();
  const competitions = await listCompetitions();

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">{t("Competições")}</h1>
      <p className="text-sm text-muted">{t("Competições incluídas no plano gratuito e guardadas na base.")}</p>
      {sync.message ? <p className="text-sm text-live">{sync.message}</p> : null}
      {competitions.length === 0 ? <p className="border border-line bg-card p-5 text-sm">{t("Não há competições guardadas.")}</p> : null}
      {competitions.length > 0 ? (
        <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {competitions.map((competition) => (
            <li key={competition.code} className="h-full">
              <CompetitionLink
                href={`/competicoes/${competition.code}`}
                name={competition.name}
                emblemUrl={competition.emblemUrl}
                detail={`${formatCountry(competition.country)} · ${competition.code}`}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
