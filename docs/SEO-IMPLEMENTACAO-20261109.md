# Correção SEO local — 09/11/2026

Branch: `seo/official-origin-20261109`. Worktree: `/home/pablo/linha-seo-20261109`.
Base: `68c3512c1209b3406d869a7f695bba4023344b94`.
Registo da preparação local. A publicação direta por master foi posteriormente autorizada, condicionada à aprovação das verificações finais abaixo.

## Correções

- Origem oficial central: https://www.linhadejogo.com. Ausência de NEXT_PUBLIC_SITE_URL usa esta origem; VERCEL_URL não participa. Configuração explícita incompatível é rejeitada sem expor o valor. Loopback permitido apenas fora de Production.
- Canonical e hreflang usam helpers comuns. Variantes gerais preservam pt-br, pt-pt e en-us; artigos existentes e templates editoriais são pt-PT, sem traduções anunciadas. Preview recebe noindex.
- Sitemap usa as mesmas regras e apenas a variante original dos artigos. /analise é omitida porque pode redirecionar dinamicamente; a funcionalidade e a rota permanecem.
- Robots aponta para o sitemap oficial em Production. Preview não anuncia sitemap.
- Artigos mantêm integralmente o texto, fontes e datas. Prefixos indisponíveis redirecionam por HTTP 308 no proxy antes do streaming, com parâmetros preservados. O seletor não oferece traduções inexistentes.
- LocalizedLink resolve caminhos no SSR e no cliente, preservando props, filtros e fontes externas. Formulário de pesquisa e redirect de análise preservam idioma.
- URLs antigas usam 308 determinístico: pt-br nas páginas gerais e pt-pt nos artigos. Esta é uma alteração intencional ao antigo destino dependente de cookie.

## Validação executada

| Verificação | Resultado |
|---|---|
| Suite Vitest completa | 224 passaram; 4 testes de integração real omitidos |
| Testes afetados após último ajuste do proxy | 30 passaram (12 proxy + 18 SEO; inclui dois novos casos) |
| Total de casos distintos aprovados na versão final | 224 |
| TypeScript independente: tsc --noEmit --incremental false | Passou após corrigir tipagem de um teste |
| Build final local: next build (Turbopack) | Passou; compilação, TypeScript e Tailwind processado |
| Browser desktop e móvel no build otimizado | 50 passaram; 4 cenários com fixtures adicionais omitidos |
| Testes Python offline | 25 passaram |
| Reporter Node | 2 passaram |
| ESLint | Zero erros; aviso preexistente no-page-custom-font no layout |
| git diff --check | Passou |
| Verificador Chromium do build final | PASS |
| HTML de Production local | 33 páginas, 11 rotas nos três idiomas |
| Sitemap local isolado | 34 entradas; origem oficial e sem traduções fictícias de artigos |
| Redirects de artigos | Dois idiomas indisponíveis: HTTP 308 |
| Navegação no browser | Duas trocas de idioma aprovadas |
| URLs antigas | Dois cenários com/sem cookie aprovados |
| URLs de deployment nos sinais SEO inspecionados | Zero |

Comandos principais: `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/next/dist/bin/next build`, `node scripts/verify-seo-production.mjs`, `git diff --check`.

Os testes e builds executaram com ambiente limpo: DATABASE_URL vazia, sem chaves de provedores e sem .env de Production. O build recebeu VERCEL_ENV=production e VERCEL_URL fictícia para reproduzir a regressão original. As dependências existentes foram inicialmente reutilizadas por symlink e depois copiadas para a worktree para validar Turbopack, sem instalar pacotes. O servidor temporário foi encerrado pelo verificador.

## Limites e pendências

- As páginas dependentes de base real renderizaram o estado sem base; consultas e estados com dados foram cobertos com mocks nos testes existentes. Não foi feita validação E2E com os 50 mil jogos, nem leitura/escrita da base real.
- Artigo inexistente pode ser servido com HTTP 200 por streaming do Next.js, mas publica noindex e nenhuma canonical. Confirmado pelo verificador. Não se alterou globalmente a estratégia de streaming.
- Tradução incompleta do conteúdo das páginas gerais, em especial notícias em en-us, permanece fora desta correção crítica. Não foram inventadas traduções.
- Novas traduções de artigos requerem conteúdo publicado e resolução própria antes de se ampliar articleLocales; atualmente existe apenas a política do original pt-PT.
- A contagem de 34 URLs do sitemap pertence ao ambiente isolado sem base; não representa a contagem esperada com os dados reais.
- A publicação direta em Production foi autorizada após os testes finais. NEXT_PUBLIC_SITE_URL está ausente e não necessita de alteração: o código usa a constante oficial. A confirmação pública é realizada depois da publicação; Search Console permanece fora desta execução.

## Preservação

Nenhum ficheiro do modelo matemático, estatísticas, base, ingestão, gerador de texto editorial ou conteúdo original dos artigos foi alterado. Nenhuma rota ou API foi removida, conforme comparação do build e diff. Os testes existentes de modelo, resultados, probabilidades, navegação e APIs passaram. Isso não substitui uma validação com serviços reais, deliberadamente excluída.

Antes da integração, master estava em 68c3512c1209b3406d869a7f695bba4023344b94 e a worktree original estava limpa. A branch de Production confirmada na Vercel é master; apenas essa branch será enviada, sem criar Preview. Não foram executadas migrations, operações Vercel/Supabase, importações, apagamentos ou alterações dos jogos históricos.

## Revisão final antes da publicação

O build Webpack anterior não processava o Tailwind configurado apenas para Turbopack e não era suficiente para aprovar a aparência. O build final usa o bundler real do projeto, Turbopack, e passou. O teste de pesquisa do blog passou sem forçar cliques. O teste de navegação móvel resolve agora o consentimento pela interface antes de usar o menu inferior, sem alterar o produto. O CI compila e testa o build otimizado isolado da mesma forma. O verificador SEO também confirma CSS efetivamente aplicado.

O verificador final passou em 33 páginas, sitemap local de 34 entradas, robots, redirects, duas trocas de idioma e zero domínios de deployment nos sinais SEO. Foram mantidas todas as asserções de estados HTTP; somente resets de ligação podem ser repetidos duas vezes.

Avisos não bloqueantes: lint sobre fontes e três avisos Turbopack de tracing em store.ts, cujo código não foi alterado. Não foram removidos testes nem usado force no browser. Oito cenários externos/fixtures permanecem explicitamente omitidos (quatro integração DB e quatro browser); nenhum usa a base real.

## Lista completa de ficheiros alterados/criados

- `.env.example`
- `.github/workflows/tests.yml`
- `docs/ARQUITETURA.md`
- `docs/SEO-IMPLEMENTACAO-20261109.md`
- `scripts/verify-seo-production.mjs`
- `src/app/analise/page.tsx`
- `src/app/blog/[slug]/not-found.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/competicoes/[code]/page.tsx`
- `src/app/equipas/[id]/page.tsx`
- `src/app/jogos/[id]/page.tsx`
- `src/app/jogos/page.tsx`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`
- `src/app/noticias/page.tsx`
- `src/app/page.tsx`
- `src/app/pesquisa/page.tsx`
- `src/app/robots.ts`
- `src/app/seo-routes.test.ts`
- `src/app/sitemap.ts`
- `src/components/analytics-consent.tsx`
- `src/components/competition-link.tsx`
- `src/components/home-sidebar.tsx`
- `src/components/locale-switcher.tsx`
- `src/components/localized-link.test.tsx`
- `src/components/localized-link.tsx`
- `src/components/match-board.tsx`
- `src/components/match-card.tsx`
- `src/components/match-context.tsx`
- `src/components/probability-tiles.test.tsx`
- `src/components/site-footer.tsx`
- `src/components/site-header.tsx`
- `src/components/site-nav.tsx`
- `src/components/stadium-hero.tsx`
- `src/content/article-locales.ts`
- `src/lib/i18n.ts`
- `src/lib/seo-path.ts`
- `src/lib/seo.test.ts`
- `src/lib/seo.ts`
- `src/lib/site-url.ts`
- `src/proxy.test.ts`
- `src/proxy.ts`
- `tests/e2e/home-phase11.spec.mjs`
- `tests/e2e/locales-and-filters.spec.mjs`
- `tests/e2e/navigation.spec.mjs`
- `tests/e2e/start-server.mjs`
