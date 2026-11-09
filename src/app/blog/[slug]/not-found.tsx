import Link from "@/components/localized-link";

export default function ArticleNotFound() {
  return (
    <div className="space-y-3">
      <h1>Artigo não encontrado</h1>
      <p className="text-sm">Este artigo não está publicado.</p>
      <Link href="/blog" className="text-sm underline-offset-4 hover:underline">
        Voltar às notícias e análises
      </Link>
    </div>
  );
}
