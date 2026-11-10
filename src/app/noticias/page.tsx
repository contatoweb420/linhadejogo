import Link from "@/components/localized-link";
import { formatArticleDate } from "@/content/blog";
import { publicArticles } from "@/server/blog-agent/public";
import { EditorialImage } from "@/components/editorial-image";
import { filterNews, readNews } from "@/server/news/store";

export const metadata = { title: "Notícias", description: "Notícias, reportagens e análises de futebol da redação Linha de Jogo, com fontes identificadas e acompanhamento das principais competições." };

type Search = { equipa?: string; competicao?: string; data?: string };

export default async function NewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const team = params.equipa?.trim() ?? "";
  const competition = params.competicao?.trim() ?? "";
  const day = params.data?.trim() ?? "";
  const [feed, published] = await Promise.all([readNews(), publicArticles()]);
  const items = filterNews(feed, { team, competition, day });
  const editorial = published.filter(article => {
    if (article.editorialType !== "news" || !article.verifiedAt) return false;
    const text = `${article.title} ${article.summary} ${(article.tags ?? []).join(" ")}`.toLocaleLowerCase("pt-PT");
    return (!team || text.includes(team.toLocaleLowerCase("pt-PT"))) && (!competition || text.includes(competition.toLocaleLowerCase("pt-PT"))) && (!day || article.publishedAt.slice(0, 10) === day);
  });

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1>Notícias</h1>
        <p className="max-w-2xl text-sm text-muted">
          Reportagens e análises da redação, com fontes identificadas, e acompanhamento de fontes externas. Os textos informativos não alteram as estimativas desportivas.
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
      {editorial.length > 0 ? <section className="grid gap-5" aria-label="Artigos da redação">
        <h2 className="font-serif text-2xl">Da redação</h2>
        <ul className="grid gap-5 md:grid-cols-2">{editorial.map(article => (
          <li key={article.slug} className="grid content-start gap-4 overflow-hidden rounded-xl border border-line bg-card p-4">
            {article.coverImage ? <EditorialImage image={article.coverImage} href={`/blog/${article.slug}`} /> : null}
            <div className="grid gap-3">
              <p className="text-xs text-muted">{article.author} · <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time></p>
              <h3 className="font-serif text-2xl"><Link href={`/blog/${article.slug}`} className="hover:text-accent">{article.title}</Link></h3>
              <p className="text-sm leading-6 text-muted">{article.summary}</p>
              <Link href={`/blog/${article.slug}`} className="text-sm text-accent underline underline-offset-4">Ler artigo completo</Link>
            </div>
          </li>
        ))}</ul>
      </section> : null}
      <section className="grid gap-4" aria-label="Fontes externas">
      <h2 className="font-serif text-2xl">Fontes externas</h2>
      <p className="text-sm text-muted">Títulos recolhidos de fontes autorizadas, ligados ao original e sem validação editorial individual.</p>
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
      </section>
      <p className="text-sm">
        <Link href="/blog" className="text-accent underline-offset-4 hover:underline">
          Todos os artigos e análises
        </Link>
      </p>
    </div>
  );
}
