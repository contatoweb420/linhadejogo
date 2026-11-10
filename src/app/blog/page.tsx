import Link from "@/components/localized-link";
import { Cover } from "@/components/cover";
import { EditorialImage } from "@/components/editorial-image";
import { BLOG_CATEGORIES, type Article } from "@/content/articles";
import { blogHref, formatArticleDate, queryArticles } from "@/content/blog";
import { publicArticles } from "@/server/blog-agent/public";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notícias e análises", description: "Artigos de futebol com análise estatística, contexto das competições e fontes identificadas." };

type Search = { q?: string; categoria?: string; pagina?: string };

export default async function BlogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.categoria?.trim() ?? "";
  const page = Number(params.pagina ?? "1");
  const listing = queryArticles({ q, category, page: Number.isFinite(page) ? page : 1 }, await publicArticles());

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1>Notícias e análises</h1>
        <p className="max-w-2xl text-sm text-muted">
          Notícias, análises e contexto do futebol, com fontes identificadas. Os artigos de exemplo estão assinalados.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        {category ? <input type="hidden" name="categoria" value={category} /> : null}
        <label className="grid min-w-0 flex-1 gap-1 text-xs uppercase tracking-[0.12em] text-muted">
          Título
          <input name="q" defaultValue={q} placeholder="Procurar pelo título" className="field" />
        </label>
        <button className="btn" type="submit">
          Pesquisar
        </button>
      </form>

      <nav aria-label="Categorias" className="flex gap-2 overflow-x-auto pb-1">
        <CategoryLink href={blogHref({ q })} current={!category}>
          Todas
        </CategoryLink>
        {BLOG_CATEGORIES.map((item) => (
          <CategoryLink key={item} href={blogHref({ q, category: item })} current={category === item}>
            {item}
          </CategoryLink>
        ))}
      </nav>

      {listing.unknownCategory ? (
        <p className="border border-line bg-card px-4 py-6 text-sm text-muted">Esta categoria não existe.</p>
      ) : null}

      {!listing.unknownCategory && !listing.featured && listing.items.length === 0 ? (
        <p className="border border-line bg-card px-4 py-6 text-sm text-muted">Não há artigos para esta pesquisa.</p>
      ) : null}

      {listing.featured ? <Featured article={listing.featured} /> : null}

      {listing.items.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listing.items.map((article) => (
            <li key={article.slug}>
              <ArticleCard article={article} />
            </li>
          ))}
        </ul>
      ) : null}

      {listing.pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
          {listing.page > 1 ? (
            <Link href={blogHref({ q, category, page: listing.page - 1 })} className="underline-offset-4 hover:underline">
              Anterior
            </Link>
          ) : (
            <span className="text-muted">Anterior</span>
          )}
          <span className="text-muted">
            Página {listing.page} de {listing.pages}
          </span>
          {listing.page < listing.pages ? (
            <Link href={blogHref({ q, category, page: listing.page + 1 })} className="underline-offset-4 hover:underline">
              Seguinte
            </Link>
          ) : (
            <span className="text-muted">Seguinte</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function Featured({ article }: { article: Article }) {
  return (
    <article className="grid gap-4 border border-line bg-card p-4 lg:grid-cols-[1.3fr_1fr] lg:items-center">
      {article.coverImage?.licenseVerified ? <EditorialImage image={article.coverImage} href={`/blog/${article.slug}`} /> : (
        <Link href={`/blog/${article.slug}`} aria-label={article.title}>
          {article.coverImage?.provider === "local-ai" ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
        </Link>
      )}
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Destaque · {article.example ? "Artigo de exemplo" : article.editorialType === "news" ? "Notícia editorial" : "Análise"}</p>
        <h2 className="font-serif text-3xl">
          <Link href={`/blog/${article.slug}`}>{article.title}</Link>
        </h2>
        <p className="text-sm text-muted">{article.summary}</p>
        <p className="text-xs text-muted">
          {article.category} · {formatArticleDate(article.publishedAt)}
        </p>
      </div>
    </article>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="grid h-full gap-3 border border-line bg-card p-3">
      {article.coverImage?.licenseVerified ? <EditorialImage image={article.coverImage} href={`/blog/${article.slug}`} /> : (
        <Link href={`/blog/${article.slug}`} aria-label={article.title}>
          {article.coverImage?.provider === "local-ai" ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
        </Link>
      )}
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{article.category}</p>
        <h2 className="text-lg">
          <Link href={`/blog/${article.slug}`}>{article.title}</Link>
        </h2>
        <p className="text-sm text-muted">{article.summary}</p>
        <p className="text-xs text-muted">{formatArticleDate(article.publishedAt)} · {article.example ? "Artigo de exemplo" : article.editorialType === "news" ? "Notícia editorial" : "Análise"}</p>
      </div>
    </article>
  );
}

function CategoryLink({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`shrink-0 border px-3 py-2 text-sm ${current ? "is-selected" : "border-line bg-card hover:bg-raised"}`}>
      {children}
    </Link>
  );
}
