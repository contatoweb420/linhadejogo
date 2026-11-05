# Auditoria técnica — 2026-11-03

## Âmbito e conclusão

Revisão local de arquitetura, configuração, rotas, autenticação editorial, persistência, automação, documentação e verificações de código. Análise detalhada de `quadrante/` e comparação pontual com `publicacao-linha-20261102/`. Não é uma certificação de segurança nem uma auditoria legal, de licenças ou da qualidade preditiva do modelo.

Existe um README funcional nas duas pastas. Faltavam um mapa do workspace, arquitetura, inventário de APIs e configuração, operação e um relatório de riscos. Esses documentos foram criados nesta revisão.

O projeto tem separação clara entre interface, dados, estatística e conteúdo, validação de respostas externas e testes unitários. Contudo, há problemas funcionais e de conservação editorial que devem ser resolvidos antes de depender da aplicação em produção.

Não foram alterados comportamentos da aplicação, credenciais, infraestrutura ou bases de dados.

## Achados prioritários

### A01 — Alta: artigos publicados podem ser eliminados pela retenção

**Evidência:** `src/server/blog-agent/store.ts:44`, função `saveAgentArticles`.

Os artigos são ordenados por estado, dando prioridade a rascunhos, revisão e agendados, antes dos publicados; depois aplica-se `slice(0, 40)` e substitui-se o ficheiro. Com 40 artigos de estados prioritários, os publicados desaparecem da persistência. Não é apenas paginação.

**Recomendação:** separar arquivo editorial de limites de apresentação; não eliminar publicados para limitar rascunhos. Criar teste com mais de 40 artigos e mistura de estados. Conservar uma cópia do JSON antes de corrigir.

### A02 — Alta: sessão da redação tem caminho incompatível com URLs por idioma

**Evidência:** `src/app/redacao/actions.ts:41` define o cookie com `path: "/redacao"`; `src/proxy.ts` redireciona páginas para `/<idioma>/...`.

Um browser em `/pt-pt/redacao` não envia um cookie limitado a `/redacao`. A verificação da sessão pode continuar a falhar depois do desbloqueio. A reescrita interna não muda as regras do browser para cookies.

**Recomendação:** alinhar o caminho do cookie com as URLs públicas e preservar o idioma nos redirects. Validar desbloqueio, atualização e saída em browser para os três idiomas. Conclusão baseada no código; não foi executado um login real.

### A03 — Alta: dados editoriais dependem de ficheiros sem controlo de concorrência

**Evidência:** `src/server/blog-agent/store.ts:22` e `src/server/news/store.ts`, escritas diretas com `writeFile`; leituras devolvem valores vazios perante qualquer erro.

Pedidos simultâneos podem ler a mesma versão e sobrescrever alterações. Uma leitura durante uma escrita ou um JSON corrompido pode ser interpretado como ausência de dados. Em disco efémero, o conteúdo pode desaparecer entre execuções; num sistema de ficheiros só de leitura, as escritas falham.

**Recomendação:** persistir conteúdo editorial e notícias em armazenamento durável com transações; até lá, usar escrita atómica e serialização das operações de leitura/alteração/escrita. Registar erros sem expor segredos e incluir estes dados no backup.

### A04 — Alta: filtros são perdidos no proxy de `quadrante`

**Evidência:** `src/proxy.ts:16` constrói `new URL` com um novo caminho sem copiar a query string.

Exemplo: `/pt-pt/jogos?data=2026-11-02&competicao=PPL` é reescrito para `/jogos`, perdendo data e competição. O mesmo mecanismo afeta pesquisa e paginação.

**Recomendação:** copiar `request.nextUrl` e alterar apenas `pathname`. A segunda pasta já tem essa implementação e `src/proxy.test.ts` com casos de preservação de filtros; rever e integrar na fonte escolhida.

### A05 — Média: idioma é colocado na resposta, mas lido no pedido

**Evidência:** `src/proxy.ts:17` usa `response.headers.set("x-site-locale", locale)`; `src/lib/get-locale.ts:5` lê `headers()` do pedido.

O código não propaga explicitamente o idioma para os cabeçalhos do pedido reescrito. Assim, a renderização do servidor pode usar `pt-BR` apesar do prefixo escolhido. Um cliente pode também enviar o seu próprio cabeçalho se ele não for substituído pelo proxy.

**Recomendação:** propagar cabeçalhos de pedido no rewrite, substituindo valores recebidos do cliente. Verificar HTML e navegação nos três idiomas. Requer confirmação em execução.

### A06 — Média: comandos de qualidade incluem cópias temporárias

**Evidência:** `vitest.config.ts` não restringe os testes a `src`; `eslint.config.mjs` não ignora `.cache`; `tsconfig.json` inclui padrões recursivos e exclui apenas `node_modules`. A `.cache` local tinha aproximadamente 1,1 GB.

`npm test` encontrou testes em cópias temporárias com imports em falta e terminou com erro. Isso mistura problemas dos artefactos com a aplicação e aumenta o custo das verificações. A inclusão ampla do TypeScript é um risco de configuração; o comando executado terminou com sucesso.

**Recomendação:** restringir a descoberta de testes e excluir cópias temporárias de lint e TypeScript. Não apagar a pasta inteira: também contém dados editoriais.

### A07 — Média: temporizadores não garantem recolha em produção

**Evidência:** `src/instrumentation.ts` inicia `src/server/blog-agent/schedule.ts`, com `setTimeout` e `setInterval`; a proteção global vale apenas para o processo atual.

Processos suspensos ou reiniciados interrompem a agenda. Múltiplas instâncias podem executar o mesmo trabalho. Não há garantia de execução única nem de cadência em alojamento por funções.

**Recomendação:** agendador externo autenticado, bloqueio distribuído e execuções idempotentes; manter registos duráveis de tentativas e falhas.

### A08 — Média: artigos aprovados podem ser reescritos automaticamente

**Evidência:** `src/server/blog-agent/run.ts:48`, função `refreshPublishedArticles`, chamada quando o agente não está pausado.

O agente pode substituir título, resumo, blocos e metadados de artigos já publicados depois do intervalo configurado. A frase do README sobre criação de rascunhos não descrevia este efeito sobre conteúdo anteriormente aprovado.

**Recomendação:** gerar uma revisão pendente para conteúdo publicado, preservar alterações humanas e guardar histórico. Documentar e decidir explicitamente a política editorial.

### A09 — Média: backup parcial e dependente de nomes fixos

**Evidência:** `scripts/backup-db.mjs` usa utilizador e base `quadrante` fixos e apenas `pg_dump` no Docker.

Alterar `POSTGRES_USER` ou `POSTGRES_DB` pode quebrar o script. Uma base remota configurada em `DATABASE_URL` não é o destino do backup. Artigos e notícias em JSON não são incluídos. Não foi encontrado procedimento automatizado de restauro.

**Recomendação:** parametrizar o destino, incluir os dados editoriais, definir retenção externa e testar recuperação numa base descartável.

### A10 — Média: acesso editorial usa um segredo partilhado sem limitação de tentativas no código

**Evidência:** `src/app/redacao/actions.ts`, `unlock`, e `src/lib/agents/shared/security.ts`.

O mesmo segredo controla redação e várias APIs. A sessão é derivada deterministicamente desse segredo, sem registo individual ou revogação por sessão; não foi encontrada limitação de tentativas nestas funções. Proteções no alojamento não foram verificadas.

**Recomendação:** separar credenciais de automação e utilizadores; limitar tentativas, permitir revogação e auditar operações. Manter segredo forte e TLS. Não foi realizado teste de força bruta.

### A11 — Média: duas cópias sem fonte oficial documentada

**Evidência:** ambas têm aplicação, dependências e README equivalentes; a segunda inclui `premium.css`, componentes próprios e a correção do proxy. Muitas diferenças de ficheiros são apenas fins de linha, mas há diferenças funcionais reais.

**Recomendação:** identificar a pasta ligada ao deploy, consolidar alterações úteis sob controlo de versões e documentar a relação entre versões. Não inferir o estado publicado a partir do nome da pasta.

### A12 — Baixa: configuração e migrações carecem de contrato operacional

**Evidência:** `package.json` fixa 3001 apenas em `dev`; o README diz que o projeto fica fixo nessa porta. `DB_DIAGNOSTIC_SECRET` não consta de `.env.example`. `scripts/apply-schema.mjs` executa uma lista fixa de SQL sem livro de migrações.

**Recomendação:** documentar porta de produção e variáveis específicas, fixar versão suportada do Node e evoluir para migrações versionadas com registo de aplicação e estratégia de recuperação. O procedimento atual pode servir para criação inicial, mas não prova segurança para alterações futuras.

## Verificações e limites

- Ambiente observado: Node.js 26.7.0 e npm 11.19.0.
- `npm test`: **falhou**, 5 ficheiros de testes falhados e 61 aprovados, 244 testes aprovados. As cinco falhas vieram de cópias em `.cache` com módulos em falta. Estes totais incluem artefactos e não representam apenas a suite principal.
- `npx tsc --noEmit`: **aprovado**, código de saída 0.
- `npx vitest run --exclude '**/.cache/**'`: **aprovado**, 13 ficheiros e 51 testes. Houve aviso sobre carregamento futuro da configuração Vite como módulo.
- `npx eslint src scripts *.ts *.mjs`: **aprovado**, zero erros e dois avisos: ficheiro gerado ignorado e regra de fontes em `src/app/layout.tsx:68`.
- `npm run lint` sem recorte não forneceu resultado durante a janela de revisão; não é declarado aprovado.
- `git diff --check`: aprovado para as alterações rastreadas. As alterações anteriores em `docker-compose.yml` e o ficheiro `.env.context7.example` foram preservados.
- Não foi executado build de produção nem navegação em browser, migração, importação, restauro ou chamada de recolha externa. Não foi validada a base de produção.
- Não foi feita consulta de advisories ou `npm audit` contra o registo; não se conclui que as dependências estejam livres de vulnerabilidades.
- Os achados de caminhos, retenção e fluxo de escrita resultam de leitura do código. Onde não houve reprodução em execução, isso está indicado.
- A auditoria não copiou os valores das credenciais locais para os documentos.

## Ordem recomendada de intervenção

1. Salvaguardar PostgreSQL e dados editoriais; identificar a pasta de produção.
2. Corrigir retenção de artigos, sessão da redação, filtros e propagação do idioma.
3. Tornar persistência e agenda adequadas ao alojamento usado; proteger as revisões humanas.
4. Corrigir descoberta de testes e exclusões, validar build e fluxos completos em browser.
5. Reforçar autenticação, migrações e recuperação; acrescentar verificações de dependências e integração contínua.

## Seguimento — preparação dos testes locais

Depois desta auditoria, foram restringidos os testes Vitest à pasta `src` e adicionadas exclusões para `.cache`, resultados Playwright e compilação E2E nas ferramentas. `npm test` passou com 13 ficheiros e 51 testes; TypeScript passou. A configuração do achado A06 foi corrigida.

Foi preparada uma suite Playwright com servidor, credenciais e armazenamento editorial isolados. Os cenários incluem as regressões A02, A04 e A05, mas não foram executados no browser devido aos bloqueios de rede e de abertura de porta do ambiente. Estes achados continuam em aberto. Consultar [Testes locais](TESTES.md) para instalação, comandos e limites.
