import { formatArticleDate } from "@/content/blog";
import { EditorialImage } from "@/components/editorial-image";
import { formatLisbonDateTime } from "@/server/format/pt";
import { configured, redacaoOpen, review, runNow, saveSettings, setPaused, unlock } from "./actions";
import { readAgentArticles, readConfig, readRuns } from "@/server/blog-agent/store";
import type { AgentStatus } from "@/server/blog-agent/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redação", robots: { index: false, follow: false } };

const STATUS: Record<AgentStatus, string> = {
  rascunho: "Rascunho",
  "em-revisao": "Em revisão",
  agendado: "Agendado",
  publicado: "Publicado",
  rejeitado: "Rejeitado",
};

export default async function RedacaoPage({ searchParams }: { searchParams: Promise<{ acesso?: string }> }) {
  const ready = await configured();
  if (!ready) {
    return (
      <section className="grid gap-3">
        <h1>Redação</h1>
        <p className="text-sm text-muted">A revisão não está configurada neste servidor.</p>
      </section>
    );
  }
  if (!(await redacaoOpen())) {
    const refused = (await searchParams).acesso === "recusado";
    return (
      <section className="mx-auto grid max-w-md gap-4">
        <h1>Redação</h1>
        <form action={unlock} className="grid gap-3 border border-line bg-card p-4">
          <label className="grid gap-1 text-sm">
            Segredo de recolha
            <input className="field" type="password" name="segredo" autoComplete="current-password" required />
          </label>
          {refused ? <p className="text-sm text-muted">O acesso não foi aceite.</p> : null}
          <button className="btn" type="submit">
            Entrar
          </button>
        </form>
      </section>
    );
  }

  const [config, articles, runs] = await Promise.all([readConfig(), readAgentArticles(), readRuns()]);
  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1>Redação</h1>
        <p className="max-w-2xl text-sm text-muted">
          Os artigos ficam em rascunho até serem aprovados aqui. As imagens mostram a licença e o crédito para revisão antes da publicação.
        </p>
      </header>

      <section className="grid gap-3 border border-line bg-card p-4">
        <h2 className="font-serif text-2xl">Agente</h2>
        <p className="text-sm text-muted">{config.paused ? "Em pausa." : "Ativo."} Máximo de {config.maxPerWeek} rascunhos por semana.</p>
        <div className="flex flex-wrap gap-2">
          <form action={setPaused}>
            <input type="hidden" name="paused" value={config.paused ? "nao" : "sim"} />
            <button className="btn" type="submit">
              {config.paused ? "Retomar" : "Pausar"}
            </button>
          </form>
          <form action={runNow}>
            <button className="btn" type="submit">
              Gerar agora
            </button>
          </form>
        </div>
        <form action={saveSettings} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Máximo por semana
            <input className="field" type="number" min={0} max={7} name="maxPerWeek" defaultValue={config.maxPerWeek} />
          </label>
          <label className="grid gap-1 text-sm">
            Intervalo em horas
            <input className="field" type="number" min={1} max={168} name="intervalHours" defaultValue={config.intervalHours} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paused" value="sim" defaultChecked={config.paused} />
            Manter em pausa
          </label>
          <button className="btn sm:col-span-2 w-fit" type="submit">
            Guardar configuração
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        <h2 className="font-serif text-2xl">Artigos</h2>
        {articles.length === 0 ? <p className="text-sm text-muted">Ainda não há rascunhos.</p> : null}
        {articles.map((article) => (
          <form key={article.id} action={review} className="grid gap-3 border border-line bg-card p-4">
            <input type="hidden" name="id" value={article.id} />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {STATUS[article.status]} · {article.category} · criado em {formatLisbonDateTime(article.createdAt)} · previsto para {formatArticleDate(article.publishOn)}
            </p>
            {article.coverImage?.licenseVerified ? <EditorialImage image={article.coverImage} preview /> : <p className="text-sm text-muted">Sem fotografia com licença confirmada; será usada a ilustração do site.</p>}
            <label className="grid gap-1 text-sm">
              Título
              <input className="field" name="title" defaultValue={article.title} />
            </label>
            <label className="grid gap-1 text-sm">
              Resumo
              <textarea className="field min-h-20" name="summary" defaultValue={article.summary} />
            </label>
            <label className="grid gap-1 text-sm">
              Título SEO
              <input className="field" name="seoTitle" defaultValue={article.seoTitle} />
            </label>
            <label className="grid gap-1 text-sm">
              Meta descrição
              <textarea className="field min-h-16" name="seoDescription" defaultValue={article.seoDescription} />
            </label>
            <div className="grid gap-2 text-sm">
              {article.blocks.map((block, index) =>
                block.type === "h2" ? (
                  <h3 key={index} className="font-serif text-xl">
                    {block.text}
                  </h3>
                ) : block.type === "ul" ? (
                  <ul key={index} className="list-disc pl-5">
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={index}>{block.text}</p>
                ),
              )}
            </div>
            <p className="text-xs text-muted">
              {article.tags.join(" · ")} · {article.reason}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm">
                Data prevista
                <input className="field" type="date" name="publishOn" defaultValue={article.publishOn} />
              </label>
              <button className="btn" type="submit" name="acao" value="rever">
                Guardar texto
              </button>
              <button className="btn" type="submit" name="acao" value="aprovar">
                Aprovar
              </button>
              <button className="btn" type="submit" name="acao" value="agendar">
                Agendar
              </button>
              <button className="btn" type="submit" name="acao" value="rejeitar">
                Rejeitar
              </button>
            </div>
          </form>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Execuções</h2>
        {runs.length === 0 ? <p className="text-sm text-muted">Ainda não há execuções.</p> : null}
        <ul className="grid gap-2">
          {runs.map((run) => (
            <li key={run.id} className="border border-line bg-card px-3 py-2 text-sm">
              <span className="text-muted">{formatLisbonDateTime(run.at)} · {run.origin} · {run.outcome}</span>
              <span className="mt-1 block">{run.reason}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
