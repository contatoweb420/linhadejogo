import type { Article } from "@/content/articles";
import { getSiteUrl } from "./site-url";
import { contentPath, seoUrl } from "./seo";

export function newsArticleSchema(article: Article) {
  if (article.editorialType !== "news" || !article.verifiedAt) return null;
  const url = seoUrl(contentPath(`/blog/${article.slug}`, "pt-PT"));
  const image = article.coverImage;
  const body = article.blocks.map(block => block.type === "ul" ? block.items.join(" ") : block.text).join("\n\n");
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#newsarticle`,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: article.title,
    description: article.summary,
    inLanguage: "pt-PT",
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: article.author, url: seoUrl("/pt-pt/sobre") },
    publisher: { "@type": "Organization", name: "Linha de Jogo", url: getSiteUrl().origin, logo: { "@type": "ImageObject", url: seoUrl("/marca/linha-de-jogo-nova.jpg") } },
    image: image ? {
      "@type": "ImageObject", url: new URL(image.imageUrl, getSiteUrl()).toString(),
      width: image.width, height: image.height,
      ...(image.licenseVerified ? { creditText: image.credit, creator: { "@type": "Person", name: image.credit }, copyrightNotice: `Foto: ${image.credit} · ${image.license}`, license: image.licenseUrl, acquireLicensePage: image.sourceUrl } : {}),
    } : undefined,
    articleSection: article.category,
    keywords: article.tags,
    isAccessibleForFree: true,
    articleBody: body,
    wordCount: body.trim().split(/\s+/).length,
    citation: article.sources.flatMap(source => source.url ? [source.url] : []),
  };
}

export function serializeNewsSchema(schema: ReturnType<typeof newsArticleSchema>) {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
