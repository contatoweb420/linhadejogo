import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupPanel } from "@/components/setup-panel";
import { pingDatabase } from "@/server/db/client";
import { lisbonToday, matchGroup } from "@/server/format/pt";
import { listMatchesForDay } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Análise de jogos", description: "Consulte uma leitura estatística dos jogos de futebol disponíveis, com contexto e limites da amostra." };

export default async function AnalysisEntryPage() {
  const database = await pingDatabase();
  if (!database) return <SetupPanel database={database} />;

  const matches = await listMatchesForDay(lisbonToday());
  const live = matches.filter((match) => matchGroup(match.status) === "live");
  const upcoming = matches.filter((match) => matchGroup(match.status) === "upcoming");
  const finished = matches.filter((match) => matchGroup(match.status) === "finished");
  const lead = live[0] ?? upcoming[0] ?? finished[finished.length - 1] ?? null;
  if (lead) redirect(`/jogos/${lead.externalId}`);

  return (
    <div className="grid gap-3">
      <h1>Análise de jogos</h1>
      <p className="max-w-xl text-sm text-muted">Não há jogos guardados para hoje. Escolhe um jogo no calendário.</p>
      <Link href="/jogos" className="text-accent underline-offset-4 hover:underline">
        Abrir o calendário
      </Link>
    </div>
  );
}
