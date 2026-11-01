# Linha de Jogo

Análise estatística de futebol. A consulta é pública. A primeira origem é o plano gratuito do football-data.org. Sem chave no servidor, a aplicação não inventa resultados.

## Executar

1. Instala Node.js e Docker Desktop.
2. Abre a pasta `quadrante`.
3. Copia `.env.example` para `.env` e para `.env.local`.
4. No `.env`, define `POSTGRES_PASSWORD` com uma palavra-passe só para este computador. Usa a mesma palavra-passe em `DATABASE_URL`, no `.env.local`.
5. Cria um acesso gratuito em https://www.football-data.org/client/register e cola o código em `FOOTBALL_DATA_API_KEY`, no ficheiro `.env`. Não coloques esse código no código-fonte nem no Git.
6. Se fores usar recolha externa, põe a chave em `SCRAPINGBEE_API_KEY` dentro de `.env.local`. O limite diário opcional é `SCRAPINGBEE_DAILY_LIMIT`. Reinicia o servidor depois de alterar este ficheiro. A chave não entra no Git.
7. No terminal, dentro de `quadrante`:

```bash
npm install
npm run db:up
npm run db:migrate
npm run dev
```

8. Abre http://localhost:3001. Este projeto fica fixo nessa porta para não ocupar a 3000 de outro site local. Reinicia `npm run dev` depois de alterar `.env.local`.

## Recolha automática

As páginas reutilizam os dados guardados: a semana de jogos durante 10 minutos, a classificação durante 1 hora, a época durante 6 horas e a lista de competições durante 24 horas. O limite local é de 8 pedidos por minuto, abaixo dos 10 do plano gratuito.

Para uma recolha sem abrir o site, define `RECOLHA_SEGREDO` no `.env.local` e agenda um pedido POST para `http://localhost:3001/api/recolha` com o cabeçalho `x-recolha-segredo`. O mesmo cabeçalho serve para `POST /api/noticias` e para `POST /api/blog-agente`. Sem esse segredo, o endereço responde como se não existisse. O agente do blog também corre enquanto o servidor está ligado e guarda rascunhos para a página `/redacao`.

### Notícias e imagens editoriais

`NEWS_RSS_SOURCES_JSON` aceita uma lista JSON de feeds RSS. Só adiciona fontes depois de verificares que os termos permitem mostrar título, excerto curto e ligação para a notícia original. Cada fonte deve incluir `id`, `name`, `url`, `kind` (`rss`), `termsUrl` e `licenseNote`. Exemplo de formato (substitui os endereços e a nota por dados verificados):

```dotenv
NEWS_RSS_SOURCES_JSON='[{"id":"fonte-exemplo","name":"Fonte de exemplo","url":"https://exemplo.pt/feed.xml","kind":"rss","termsUrl":"https://exemplo.pt/termos","licenseNote":"Uso de título e excerto permitido nos termos consultados"}]'
```

O coletor deduplica pela ligação original, guarda os itens em `.cache/noticias.json` e impõe um intervalo mínimo de cinco minutos entre recolhas. Sem feeds configurados, não recolhe notícias.

As imagens do blog são pesquisadas no Wikimedia Commons; só entram candidatas cuja API forneça metadados de licença reconhecidos (domínio público, CC0 ou CC BY/CC BY-SA). O agente regista URL de origem, autor, texto alternativo, licença e data da verificação. A chave `PEXELS_API_KEY` é opcional e fica apenas no servidor; quando configurada, o Pexels também é pesquisado. `IMAGE_SEARCH_DAILY_LIMIT` limita as pesquisas e o cache em memória evita pedidos repetidos durante 30 minutos. Uma imagem sem licença verificável não é usada.

Os artigos do agente ficam sempre em rascunho. Em `/redacao`, revê o texto, a imagem, o crédito e a licença antes de aprovar ou agendar a publicação.

## Cópia da base

`npm run db:backup` grava um ficheiro em `backups/`. Essa pasta não entra no Git.

## Plano gratuito

Doze competições, entre elas a Primeira Liga, a Premier League, a Liga dos Campeões, a Bundesliga, a Ligue 1, a Serie A, a La Liga, a Eredivisie, o Championship, a Serie A do Brasil, o Mundial e o Europeu. Calendário, resultados com possível atraso e classificações. Não inclui resultados em direto, plantéis completos, golos esperados nem estatísticas detalhadas de remates e posse de bola. Esses campos aparecem como «Não disponível».

## Comandos

- `npm run dev` inicia a aplicação.
- `npm test` corre os testes.
- `npm run lint` verifica o código.
- `npm run db:up` arranca a base de dados.
- `npm run db:migrate` cria as tabelas.
- `npm run db:backup` guarda uma cópia local.
