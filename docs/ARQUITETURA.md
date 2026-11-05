# Arquitetura

Documento baseado no código local observado em 2026-11-03. As versões abaixo são as declaradas no `package.json`, não uma verificação de atualizações ou vulnerabilidades.

## Tecnologia e estrutura

Next.js 16.4.2 com App Router, React 19.3.0, TypeScript estrito, Tailwind CSS 4, PostgreSQL 16 no Docker local, Drizzle ORM e cliente `postgres`. Validação de respostas externas com Zod; testes com Vitest e análise estática com ESLint.

| Caminho | Responsabilidade |
| --- | --- |
| `src/app/` | Páginas, metadados, endpoints e ações da redação |
| `src/components/` | Interface, gráficos, navegação e seleção de idioma |
| `src/server/providers/` | football-data.org, catálogo e normalização de resultados |
| `src/server/ingest/` | Sincronização e gravação de dados desportivos |
| `src/server/db/` | Cliente PostgreSQL e esquema Drizzle |
| `src/server/queries.ts` | Consultas usadas pelas páginas |
| `src/server/stats/` | Estatísticas das equipas, resultados e confrontos |
| `src/server/model/` | Modelo Poisson, confiança e avaliação histórica |
| `src/server/news/` | Fontes RSS, recolha e armazenamento local |
| `src/server/blog-agent/` | Geração por regras, revisão, agenda e armazenamento editorial |
| `src/server/images/` | Pesquisa de imagens e respetivos metadados |
| `src/lib/agents/` | Serviços news, blogs, forums e reviews; integração Webz e cache |
| `src/content/` | Conteúdo editorial incluído no código |
| `drizzle/` | SQL de criação do esquema |
| `scripts/` | Aplicação de esquema, backup e importação histórica |

## Fluxos de dados

1. As páginas consultam os módulos do servidor e a base de dados.
2. A sincronização consulta football-data.org e guarda entidades e resultados em PostgreSQL.
3. As estatísticas e probabilidades são calculadas a partir dos jogos disponíveis. A avaliação histórica compara o modelo com uma referência através de Brier score e log loss; usa apenas jogos anteriores ao jogo avaliado.
4. O coletor de notícias usa as fontes configuradas em `NEWS_RSS_SOURCES_JSON` e guarda notícias em `.cache/noticias.json`.
5. O agente editorial cria rascunhos a partir de classificações. O código também promove agendados e atualiza artigos publicados. A redação permite rever, aprovar, agendar e rejeitar.

O nome «agente» não implica geração por um modelo de linguagem: o fluxo editorial observado usa regras e dados locais.

## Persistência

- PostgreSQL: entidades desportivas, resultados e cache dos serviços conforme o esquema.
- `.cache/noticias.json`: notícias recolhidas.
- `.cache/blog-agente/`: configuração, artigos e registos de execução.
- `backups/`: exportações SQL locais geradas pelo script.

Os ficheiros editoriais são dados de negócio apesar de estarem numa pasta chamada cache. Não apagar `.cache` indiscriminadamente. Consultar a auditoria sobre retenção, concorrência e ambientes sem disco persistente.

## Rotas

Públicas: `/`, `/jogos`, `/jogos/[id]`, `/competicoes`, `/competicoes/[code]`, `/equipas/[id]`, `/analise`, `/avaliacao`, `/pesquisa`, `/noticias`, `/blog`, `/blog/[slug]`, `/sobre`, `/privacidade`, `/condicoes`.

O proxy acrescenta prefixos `pt-br`, `pt-pt` ou `en-us`, guarda uma preferência em cookie e reescreve a URL para a página interna. O leitor de idioma usa o cabeçalho de pedido `x-site-locale`; ver a divergência no proxy descrita na auditoria.

`/redacao` usa o segredo de recolha para abrir uma sessão editorial. As ações de alteração verificam essa sessão.

| API | Método | Acesso e finalidade |
| --- | --- | --- |
| `/api/recolha` | POST | `x-recolha-segredo`; sincroniza competições e janela de jogos |
| `/api/noticias` | POST | Mesmo cabeçalho; recolhe notícias |
| `/api/blog-agente` | POST | Mesmo cabeçalho; executa o agente editorial |
| `/api/news`, `/api/blogs`, `/api/forums`, `/api/reviews` | GET e POST | Mesmo cabeçalho; serviços de agentes, com possibilidade de acesso externo/cache |
| `/api/diagnostico-db` | POST | Apenas `VERCEL_ENV=production`; `Authorization: Bearer <segredo>`; testa PostgreSQL com TLS |

As primeiras três APIs devolvem 404 sem segredo válido. Os quatro serviços de agentes devolvem 401. O diagnóstico exige `DB_DIAGNOSTIC_SECRET` com 64 caracteres hexadecimais; devolve estado e código de erro, sem palavra-passe.

## Variáveis de ambiente

Os valores de exemplo estão em `.env.example`. Não guardar credenciais em documentação ou no Git.

| Variáveis | Utilização |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose; colocar em `.env` |
| `DATABASE_URL` | Ligação do servidor e scripts à base de dados |
| `FOOTBALL_DATA_API_KEY` | Fonte de dados principal; o código também aceita `FOOTBALL_DATA_TOKEN` como alternativa |
| `RECOLHA_SEGREDO` | APIs de recolha/agentes e acesso à redação |
| `NEWS_RSS_SOURCES_JSON` | Lista de fontes com URL HTTPS, identificação, termos e nota de licença |
| `SCRAPINGBEE_API_KEY`, `SCRAPINGBEE_DAILY_LIMIT` | Recolha externa opcional e limite local |
| `PEXELS_API_KEY`, `IMAGE_SEARCH_DAILY_LIMIT` | Pesquisa opcional de imagens e limite |
| `WEBZ_API_TOKEN`, `WEBZ_DAILY_LIMIT` | Serviços Webz e limite |
| `NEXT_PUBLIC_SITE_URL` | Endereço público para URLs do site |
| `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_TIKTOK_URL` | Ligações sociais públicas |
| `DB_DIAGNOSTIC_SECRET`, `VERCEL_ENV` | Condições específicas do endpoint de diagnóstico; ausentes do exemplo atual |

O Next.js lê `.env.local` antes de `.env`; os scripts de migração e importação carregam explicitamente `.env.local`. Recomenda-se manter credenciais da aplicação em `.env.local` e variáveis do Compose em `.env`, evitando duplicados divergentes. Variáveis `NEXT_PUBLIC_*` são públicas e nunca devem conter segredos.
