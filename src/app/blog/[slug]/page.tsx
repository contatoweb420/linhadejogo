import Link from "@/components/localized-link";
import { notFound, permanentRedirect } from "next/navigation";
import { Cover } from "@/components/cover";
import { EditorialImage } from "@/components/editorial-image";
import { ShareArticle } from "@/components/share-article";
import type { ArticleBlock } from "@/content/articles";
import { formatArticleDate } from "@/content/blog";
import { getLocale } from "@/lib/get-locale";
import { ORIGINAL_ARTICLE_LOCALE } from "@/content/article-locales";
import { seoAlternates, contentPath } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";
import { publicArticle } from "@/server/blog-agent/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await publicArticle(slug);
  if (!article) return { title: "Artigo não encontrado", alternates: { canonical: null, languages: {} }, robots: { index: false, follow: false } };
  if (await getLocale() !== ORIGINAL_ARTICLE_LOCALE) permanentRedirect(contentPath(`/blog/${article.slug}`, ORIGINAL_ARTICLE_LOCALE));
  const siteUrl = getSiteUrl();
  const alternates = seoAlternates(`/blog/${article.slug}`, ORIGINAL_ARTICLE_LOCALE);
  const canonical = alternates.canonical;
  const artwork = article.coverImage?.provider === "local-ai" ? article.coverImage : null;
  const shareImagePath = artwork?.imageUrl ?? "/marca/linha-de-jogo-nova.jpg";
  const shareImage = siteUrl ? new URL(shareImagePath, siteUrl).toString() : artwork ? shareImagePath : undefined;
  return {
    title: article.editorialType === "news" ? { absolute: article.seoTitle || article.title } : article.seoTitle || article.title,
    description: article.seoDescription || article.summary,
    ...(article.editorialType === "news" ? { keywords: article.seoKeyword ? [article.seoKeyword, ...(article.tags ?? [])] : article.tags } : {}),
    alternates,
    openGraph: {
      type: "article",
      url: canonical,
      title: article.editorialType === "news" ? article.title : article.seoTitle || article.title,
      description: article.seoDescription || article.summary,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: shareImage ? [{ url: shareImage, width: artwork?.width ?? 1024, height: artwork?.height ?? 520, alt: artwork?.alt ?? article.title }] : undefined,
      ...(article.editorialType === "news" ? { section: article.category, tags: article.tags } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: article.editorialType === "news" ? article.title : article.seoTitle || article.title,
      description: article.seoDescription || article.summary,
      images: shareImage ? [shareImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await publicArticle(slug);
  if (!article) notFound();
  if (await getLocale() !== ORIGINAL_ARTICLE_LOCALE) permanentRedirect(contentPath(`/blog/${article.slug}`, ORIGINAL_ARTICLE_LOCALE));
  const news = article.editorialType === "news";

  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <p className="text-sm">
        <Link href="/blog" className="text-accent underline-offset-4 hover:underline">
          Notícias e análises
        </Link>
      </p>
      <p className="border border-line bg-card px-4 py-3 text-sm">
        {article.example
          ? "Artigo de exemplo. Não descreve um jogo, um resultado nem uma notícia reais."
          : news ? "Notícia editorial · Fontes identificadas no final do artigo."
          : "Análise escrita com números guardados na Linha de Jogo. Descreve o que já está na tabela e não é uma previsão."}
      </p>
      <header className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{article.category}</p>
        <h1 className={article.slug === "cristiano-ronaldo-despede-se-selecao-portuguesa"
          ? "my-2 font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.12] tracking-tight text-balance break-words"
          : undefined}>{article.title}</h1>
        {news ? <p className="border-l-2 border-accent pl-4 text-lg leading-8 text-muted">{article.summary}</p> : null}
        <p className="text-sm text-muted">
          {article.author} · Publicado em <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          {" · "}Atualizado em <time dateTime={article.updatedAt}>{formatArticleDate(article.updatedAt)}</time>
        </p>
      </header>
      {article.coverImage && (article.coverImage.provider === "local-ai" || article.coverImage.licenseVerified) ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
      {!news ? <p className="text-base leading-7">{article.summary}</p> : null}
      {!news ? <figure className="grid gap-2">
        <Cover scene={inlineScene(article.cover)} label={illustrationAlt(inlineScene(article.cover))} />
        <figcaption className="text-xs text-muted">Ilustração de contexto; não representa um jogo ou uma fotografia real.</figcaption>
      </figure> : null}
      <div className={news ? "reading grid gap-6 text-[17px] sm:text-lg" : "reading grid gap-4 text-sm"}>
        {article.blocks.map((block, index) => (
          <Block key={`${block.type}-${index}`} block={block} editorial={news} />
        ))}
      </div>
      {news && article.tags?.length ? <ul aria-label="Etiquetas" className="flex flex-wrap gap-2">
        {article.tags.map(tag => <li key={tag} className="rounded-full border border-line bg-card px-3 py-1 text-xs text-accent">{tag}</li>)}
      </ul> : null}
      <section className="grid gap-2 border-t border-line pt-4">
        <h2 className="text-base">Partilhar</h2>
        <ShareArticle title={article.title} />
      </section>
      <section className="grid gap-2">
        <h2 className="text-base">Fontes</h2>
        <ul className="grid gap-2 text-sm text-muted">
          {article.sources.map((source) => (
            <li key={source.name}>
              {source.url ? <a className="text-accent underline underline-offset-4" href={source.url} rel="noreferrer">{source.name}</a> : source.name}. {source.note}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function inlineScene(scene: string) {
  const alternates: Record<string, string> = {
    estadio: "forma",
    analise: "golos",
    forma: "confronto",
    confronto: "analise",
    golos: "estadio",
    competicao: "confronto",
  };
  return alternates[scene] ?? "estadio";
}

function illustrationAlt(scene: string) {
  const descriptions: Record<string, string> = {
    estadio: "Ilustração estilizada de um estádio de futebol",
    analise: "Ilustração de um gráfico de barras estatísticas",
    forma: "Ilustração de uma sequência de resultados desportivos",
    confronto: "Ilustração de duas equipas em comparação",
    golos: "Ilustração de uma baliza de futebol",
    competicao: "Ilustração de um troféu de competição",
  };
  return descriptions[scene] ?? "Ilustração editorial de futebol";
}

function Block({ block, editorial = false }: { block: ArticleBlock; editorial?: boolean }) {
  if (block.type === "h2") return <h2 className={editorial ? "mt-4 border-b border-line pb-3 font-serif text-2xl text-foreground" : "text-xl"}>{block.text}</h2>;
  if (block.type === "ul") {
    return (
      <ul className={editorial ? "list-disc space-y-3 border-l-2 border-accent bg-card py-4 pl-8 pr-4 font-semibold" : "list-disc space-y-1 pl-5"}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p>{block.text}</p>;
}
