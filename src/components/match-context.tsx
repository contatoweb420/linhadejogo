import Link from "@/components/localized-link";
import { newsForMatch, readNews } from "@/server/news/store";

export async function MatchContext({ names }: { names: string[] }) {
  const related = newsForMatch(await readNews(), names).slice(0, 3);
  return (
    <section className="border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Contexto do jogo</h2>
      {related.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem notícias relevantes confirmadas encontradas.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {related.map((item) => (
            <li key={item.id} className="text-sm">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-muted">{item.summary}</p>
              <p className="mt-1 text-xs text-muted">
                {item.sourceName} · Não confirmado pela redação · Não altera a estimativa
              </p>
              <a href={item.url} className="text-accent underline-offset-4 hover:underline" rel="noreferrer">
                Abrir a fonte
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm">
        <Link href="/noticias" className="text-accent underline-offset-4 hover:underline">
          Ver notícias guardadas
        </Link>
      </p>
    </section>
  );
}
