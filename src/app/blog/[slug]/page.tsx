import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { EditorialImage } from "@/components/editorial-image";
import { ShareArticle } from "@/components/share-article";
import type { ArticleBlock } from "@/content/articles";
import { formatArticleDate } from "@/content/blog";
import { getSiteUrl } from "@/lib/site-url";
import { publicArticle } from "@/server/blog-agent/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await publicArticle(slug);
  if (!article) return { title: "Artigo não encontrado", robots: { index: false, follow: false } };
  const siteUrl = getSiteUrl();
  const canonical = siteUrl ? new URL(`/blog/${article.slug}`, siteUrl).toString() : undefined;
  const shareImage = siteUrl ? new URL("/marca/linha-de-jogo-nova.jpg", siteUrl).toString() : undefined;
  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.summary,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: "article",
      url: canonical,
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.summary,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: shareImage ? [{ url: shareImage, width: 1024, height: 520, alt: article.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.summary,
      images: shareImage ? [shareImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await publicArticle(slug);
  if (!article) notFound();

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
          : "Análise escrita com números guardados na Linha de Jogo. Descreve o que já está na tabela e não é uma previsão."}
      </p>
      <header className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{article.category}</p>
        <h1>{article.title}</h1>
        <p className="text-sm text-muted">
          {article.author} · Publicado em <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          {" · "}Atualizado em <time dateTime={article.updatedAt}>{formatArticleDate(article.updatedAt)}</time>
        </p>
      </header>
      {article.coverImage?.licenseVerified ? <EditorialImage image={article.coverImage} /> : <Cover scene={article.cover} label={article.title} />}
      <p className="text-base leading-7">{article.summary}</p>
      <figure className="grid gap-2">
        <Cover scene={inlineScene(article.cover)} label={illustrationAlt(inlineScene(article.cover))} />
        <figcaption className="text-xs text-muted">Ilustração de contexto; não representa um jogo ou uma fotografia real.</figcaption>
      </figure>
      <div className="reading grid gap-4 text-sm">
        {article.blocks.map((block, index) => (
          <Block key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
      <section className="grid gap-2 border-t border-line pt-4">
        <h2 className="text-base">Partilhar</h2>
        <ShareArticle title={article.title} />
      </section>
      <section className="grid gap-2">
        <h2 className="text-base">Fontes</h2>
        <ul className="grid gap-2 text-sm text-muted">
          {article.sources.map((source) => (
            <li key={source.name}>
              {source.name}. {source.note}
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

function Block({ block }: { block: ArticleBlock }) {
  if (block.type === "h2") return <h2 className="text-xl">{block.text}</h2>;
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p>{block.text}</p>;
}
