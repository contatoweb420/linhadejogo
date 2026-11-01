import Link from "next/link";
import { formatArticleDate } from "@/content/blog";
import { filterNews, readNews } from "@/server/news/store";

export const metadata = { title: "Notícias", description: "Acompanhe notícias de futebol recolhidas de fontes autorizadas e ligadas às suas origens." };

type Search = { equipa?: string; competicao?: string; data?: string };

export default async function NewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const team = params.equipa?.trim() ?? "";
  const competition = params.competicao?.trim() ?? "";
  const day = params.data?.trim() ?? "";
  const items = filterNews(await readNews(), { team, competition, day });

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1>Notícias</h1>
        <p className="max-w-2xl text-sm text-muted">
          Só aparecem títulos recolhidos de fontes autorizadas, com ligação para o original. Nada disto está confirmado pela redação e não altera as estimativas.
        </p>
      </header>
      <form method="get" className="grid gap-3 sm:grid-cols-4" role="search">
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted">
          Equipa
          <input name="equipa" defaultValue={team} className="field" />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted">
          Competição
          <input name="competicao" defaultValue={competition} className="field" />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted">
          Data
          <input name="data" type="date" defaultValue={day} className="field" />
        </label>
        <div className="flex items-end">
          <button className="btn" type="submit">
            Filtrar
          </button>
        </div>
      </form>
      {items.length === 0 ? (
        <p className="border border-line bg-card px-4 py-6 text-sm text-muted">
          Sem notícias relevantes confirmadas encontradas. Ainda não há uma fonte autorizada para lesões, suspensões ou declarações.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.id} className={`border border-line bg-card p-4 ${index === 0 ? "lg:col-span-2" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {item.sourceName} · Relevância {item.relevance} · Não confirmado
              </p>
              <h2 className={`mt-1 font-serif ${index === 0 ? "text-3xl" : "text-xl"}`}>
                <a href={item.url} className="hover:underline" rel="noreferrer">
                  {item.title}
                </a>
              </h2>
              <p className="mt-2 text-sm text-muted">{item.summary}</p>
              {item.sourceTermsUrl ? <p className="mt-2 text-xs text-muted">Uso conforme: <a className="underline" href={item.sourceTermsUrl} rel="noreferrer">termos da fonte</a>{item.sourceLicenseNote ? ` · ${item.sourceLicenseNote}` : ""}</p> : null}
              <p className="mt-2 text-xs text-muted">{item.publishedAt ? formatArticleDate(item.publishedAt.slice(0, 10)) : "Data não disponível"}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        <Link href="/blog" className="text-accent underline-offset-4 hover:underline">
          Textos de exemplo do blog
        </Link>
      </p>
    </div>
  );
}
