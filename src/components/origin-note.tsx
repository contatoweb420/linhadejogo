import { formatLisbonDateTime } from "@/server/format/pt";

export function OriginNote({
  fetchedAt,
  remoteUpdatedAt,
  delayed = false,
}: {
  fetchedAt: Date | string | null;
  remoteUpdatedAt?: Date | string | null;
  delayed?: boolean;
}) {
  return (
    <p className="text-sm text-muted">
      {fetchedAt ? `Última atualização guardada: ${formatLisbonDateTime(fetchedAt)} (hora de Lisboa).` : "Sem atualização registada."}
      {remoteUpdatedAt ? ` Atualização do registo: ${formatLisbonDateTime(remoteUpdatedAt)}.` : ""}
      {delayed ? " Os resultados deste plano podem chegar com atraso." : ""}
    </p>
  );
}
