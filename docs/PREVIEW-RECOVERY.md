# Recuperação do arquivo original — exclusivamente Preview

## Fecho final — integração Preview aprovada

Relatório real: `/home/pablo/backups/linhadejogo/preview-validation-0909a80d-3899-4a2f-a94b-1f46d10eab7e.json`, registado em 2026-11-07 às 11:15 UTC. Destino `eoroljcefsurgsxegfzp`, sessão read-only, sem repetir auditoria da base. Os quatro testes executaram os corpos e passaram: homepage; competições/classificações do agente; detalhes de jogo/equipa; previsões históricas.

## Retoma de 2026-11-07 — correção local; integração real pendente

Este registo atualiza a pausa abaixo. Não há sessão anterior do validador ativa.
Foram preservados todos os ficheiros e alterações existentes.

A inspeção das versões instaladas (postgres.js 3.4.9 e Drizzle 0.45.4) e
um transporte PostgreSQL em memória, sem rede, reproduziram dois problemas:

- `reserve()` numa conexão nova com `fetch_types: false` fica pendente. No
  `ReadyForQuery`, o caminho `initial.reserve` com `needsTypes=false` termina
  sem entregar a reserva. Isto explica o timeout do `beforeAll` na linha 48.
  O relatório antigo não preservou a mensagem original do timeout; não é
  possível recuperá-la desse JSON.
- Depois de desbloquear a reserva, `drizzle(reserved)` lança exatamente
  `TypeError: Cannot read properties of undefined (reading 'parsers')`, em
  `drizzle-orm/postgres-js/driver.js:18:20`. O handle reservado não contém
  `options` em runtime, apesar de `ReservedSql` estender `Sql` nos tipos.

Correção mínima: manter `fetch_types` no valor padrão do driver e fornecer ao
mesmo handle reservado `options` do cliente original. Os mapas de parsers e
serializers continuam a ser os do executor real. Nenhuma conexão alternativa
é passada ao Drizzle. Mantêm-se BEGIN REPEATABLE READ READ ONLY, timeout local,
identidade/PID antes dos corpos, ROLLBACK e release, incluindo falhas de setup.

Os 12 testes offline específicos passaram: reserva inicial com ambos os valores
de `fetch_types`, exceção real do Drizzle antes da adaptação, mesmo executor após
a adaptação, identidade/read-only/PID e cleanup quando BEGIN ou ROLLBACK falha.

Verificações locais nesta retoma: 189 testes aprovados e quatro integrações
ignoradas por ausência de credenciais; TypeScript aprovado; lint completo sem
erros e com o aviso preexistente em `src/app/layout.tsx`. Após o ajuste de tipos
do transporte offline, TypeScript e lint dos três ficheiros de teste/sessão
foram novamente aprovados. `git diff --check` aprovado. Estas verificações não
substituem nem antecipam a aprovação dos quatro testes remotos.

**Pendente:** execução pelo utilizador no terminal com entrada oculta:

```bash
cd '/home/pablo/Projects/SITE APOSTAS/quadrante'
python3 -B scripts/validate-preview.py --integration-only --keep-session
```

Partilhar somente REPORT_PATH. Não repetir auditoria/restauro. Não há aprovação
remota dos quatro testes nesta retoma enquanto não existir novo relatório real.
Production não foi acedida. Não houve commit, push, merge ou deploy.

## PAUSA SEGURA — último estado registado

Trabalho pausado por instrução expressa do utilizador. Todas as alterações estão
gravadas nos ficheiros. Nenhum ficheiro modificado, novo ou não rastreado foi
descartado, apagado ou revertido. Preservar também `.vitest/`, `supabase/`, todos
os relatórios de diagnóstico e o backup original. Não executar testes ou alterar
código até nova instrução de retoma. Não houve commit, push, merge ou deployment.

Último relatório lido:
`/home/pablo/backups/linhadejogo/preview-validation-5f1530b4-7a9c-4a27-8fc5-0403e37f38dc.json`.
Estado agregado: `EXECUTOR_ERROR`. Os quatro processos terminaram com código 1,
os quatro corpos de teste não foram executados e o diagnóstico é
`TEST_PROCESS / UNCLASSIFIED_SETUP_ERROR`.

**Próximo problema a resolver:** `UNCLASSIFIED_SETUP_ERROR` em
`src/server/db/preview-readonly.integration.test.ts:48:3`.
Não interpretar este estado como falha comprovada das consultas SQL.

Concluído antes da pausa: restauro confirmado com RECOVERY_COMMITTED; 13
contagens coincidentes com a origem (50.388 jogos e 114 sync_state); integridade,
duplicados, schema, índices e sequência aprovados pelo relatório pós-restauro;
184 testes locais aprovados, TypeScript aprovado, lint sem erros (um aviso
preexistente); build Webpack anterior aprovado. A correção read-only passou nos
testes offline, mas a integração real não está aprovada.

Pendente: identificar a falha de setup na linha indicada, corrigir apenas a causa
comprovada e executar os quatro testes reais read-only. Só após os quatro
passarem poderá ser considerada a preparação final de publicação, sujeita a
autorização própria. Não repetir restauro ou auditoria completa.

Estado Git confirmado na pausa:

- Branch: `preview/linhadejogo-2026-11-05`.
- HEAD: `0a214fe56041ab838a42c2ca57f398c06a304268`.
- Working tree com alterações locais, sem commit novo.

```text
 M src/app/api/diagnostico-football/route.test.ts
 M src/app/api/recolha/route.ts
 M src/server/db/schema.ts
 M src/server/ingest/sync.ts
 M src/server/providers/football-data.ts
?? .vitest/
?? docs/PREVIEW-RECOVERY.md
?? drizzle/0003_openfootball_archive.sql
?? scripts/audit-preview-schema.sql
?? scripts/diagnose-preview.mjs
?? scripts/preview-recovery-origin.json
?? scripts/preview-vitest-reporter.mjs
?? scripts/preview-vitest-reporter.test.mjs
?? scripts/restore-preview.py
?? scripts/test_restore_preview.py
?? scripts/test_validate_preview.py
?? scripts/validate-preview.py
?? src/app/api/recolha/route.test.ts
?? src/server/db/archive-schema.test.ts
?? src/server/db/preview-readonly-session.test.ts
?? src/server/db/preview-readonly-session.ts
?? src/server/db/preview-readonly.integration.test.ts
?? src/server/ingest/sync.test.ts
?? supabase/
```

Retomar pela inspeção local, sem testes ou ligação à base:

```bash
cd '/home/pablo/Projects/SITE APOSTAS/quadrante'
nl -ba src/server/db/preview-readonly.integration.test.ts | sed -n '35,65p'
```

Se o processo `--keep-session` ainda estiver aberto, não carregar Enter antes de
diagnosticar e corrigir esta falha. Nenhuma credencial foi gravada neste registo.
Production continua fora do âmbito. Este registo de pausa prevalece sobre os
estados intermédios descritos abaixo.

Destino autorizado: `eoroljcefsurgsxegfzp`, branch
`preview/linhadejogo-2026-11-05`. Production está fora do âmbito.

## Estado pós-restauro

O utilizador confirmou que a execução terminou com `RECOVERY_COMMITTED`.
O restauro não deve ser repetido. Relatório pós-restauro lido e confirmado:
`/home/pablo/backups/linhadejogo/preview-validation-d92251ee-a637-4446-9667-7d9fe8a3e312.json`,
registado em 2026-11-06 às 20:44 UTC. As 13 contagens coincidem com o backup,
incluindo 50.388 jogos e 114 registos em sync_state. As 12 relações verificadas
não têm órfãos, as identidades externas não têm duplicados e o schema,
constraints, três índices parciais e sequência foram aprovados.

O relatório anterior guardou apenas `FAILED_OUTPUT_SUPPRESSED` para a integração;
não preservou a identificação dos testes falhados nem a causa. Não é possível
recuperar esses detalhes do ficheiro. Não se conclui que os quatro testes
falharam: o resultado era agregado.

Foi corrigida essa perda de diagnóstico no validador: o modo `--integration-only`
executa cada teste isoladamente e guarda apenas nome, resultado, fase e código
sanitizado. Não repete a auditoria nem publica mensagens originais, SQL ou
credenciais. A causa funcional continua pendente da reprodução, sem alterações
especulativas ao comportamento da aplicação.

O relatório seguinte,
`preview-validation-412a73d9-13c7-4076-a19b-f85d776263ff.json`, mostrou quatro
`REPORT_UNAVAILABLE`. A reprodução local sem base identificou a causa exata:
o Vitest instalado grava o JSON por omissão em `.vitest/json/output.json`;
stdout contém apenas o anúncio do caminho. O executor interpretava esse anúncio
como JSON e convertia um problema de recolha em falsa falha de consultas.

Correção comprovada do executor:

- `--outputFile` aponta explicitamente para um descritor memfd herdado pelo
  processo, com modo 0600. O JSON bruto fica em memória, sem ficheiro persistente.
- O relatório é lido desse descritor; stdout e stderr são capturados e reduzidos
  a tamanhos e sinais de diagnóstico numa allowlist, sem conteúdo arbitrário.
- Cada resultado inclui `executor_exit_code`, origem e tamanho do JSON.
- `EXECUTOR_ERROR`, `NOT_RUN`, `BLOCKED`, `FAILED` e `PASSED` são estados distintos.
- Reprodução offline dos quatro processos: códigos de saída 0, quatro relatórios
  JSON lidos e testes SQL corretamente classificados `NOT_RUN / TEST_SKIPPED`.
  Isto aprova o executor, não a integração remota.

Para repetir somente a prova offline, sem credenciais ou base:

```bash
python3 -B scripts/validate-preview.py --executor-self-test
```

### Erros de setup omitidos pelo JSON padrão do Vitest

O relatório `preview-validation-ba44ad01-f4c0-498b-bc7f-1df587bb2458.json`
confirmou quatro processos com código 1, JSON disponível e sem diagnóstico.
Esse ficheiro sanitizado não contém as mensagens nem os stacks originais.

Foi reproduzida localmente, sem ligação à base, a mesma assinatura do JSON
padrão: quatro testes skipped, zero testes falhados, suites falhadas, mensagem
do módulo vazia e aproximadamente 1.928 bytes. O código do reporter instalado
lê erros do módulo e dos testes, mas omite erros do beforeAll da suite aninhada.
O aviso Vite em stderr não identifica a causa dessa falha de setup.

`scripts/preview-vitest-reporter.mjs` substitui o JSON padrão nesta validação.
Usa a API de reporters para recolher erros do módulo, suites aninhadas, testes
e erros não tratados. Só emite fases/códigos permitidos e frames de stack no
ficheiro de integração conhecido. Mensagens e stacks arbitrários não são
persistidos. O resultado distingue `test_body_executed=false` de um teste
realmente executado e falhado.

Uma falha deliberada no guard de destino, sem rede nem credenciais, comprovou
a captura de `SETUP / UNCLASSIFIED`, código de saída 1 e frames sanitizados.
Não se atribui essa causa ao Preview: a causa remota ainda depende do novo
relatório. O teste unitário do reporter cobre também beforeAll e erros globais.

Para manter a ligação apenas em memória enquanto se analisa e corrige a falha:

```bash
python3 -B scripts/validate-preview.py --integration-only --keep-session
```

Em caso de falha, partilhar apenas REPORT_PATH e deixar o processo à espera.
Só carregar Enter após uma correção confirmada; `q` encerra a sessão. Não há
retries automáticos nem credenciais guardadas. Os quatro resultados remotos
continuam pendentes; nenhuma integração foi declarada aprovada.

### Correção de SESSION_IDENTITY / READ_ONLY_OFF

O relatório `preview-validation-24dc9139-da25-4c96-ae22-33c5376f5a79.json`
identificou os quatro testes bloqueados no beforeAll, antes dos corpos,
com `SESSION_IDENTITY / READ_ONLY_OFF`. A confirmação read-only feita pelo
psql do utilitário não dizia respeito à conexão independente do postgres.js.
O teste dependia do parâmetro de arranque `default_transaction_read_only`,
que não garantiu `transaction_read_only=on` nessa sessão efetiva.

O teste passa a reservar uma conexão (`client.reserve()`), abrir explicitamente
`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, aplicar timeout
local e consultar identidade, modo read-only e `pg_backend_pid()` nesse handle.
O Drizzle recebe exclusivamente esse mesmo handle reservado, após aprovação.
Antes de cada corpo, verificam-se novamente identidade, read-only e o mesmo PID.
Uma troca de conexão ou perda de read-only bloqueia o teste. No fim há ROLLBACK
e libertação da reserva, sem COMMIT, escrita de dados ou alteração permanente.

Os guards de host, porta, referência no utilizador e CA com validação TLS
continuam inalterados. Não se usa a sessão de psql como prova da sessão Drizzle.
Os testes offline incluem modo inicial off, BEGIN não respeitado, identidade
incorreta, troca de PID, perda de read-only e cleanup com rollback.

Com `--keep-session` ainda à espera, basta carregar Enter no próprio processo
após esta correção. Não executar um comando de shell nesse prompt nem reiniciar
a sessão: os novos processos Vitest carregam os ficheiros corrigidos e reutilizam
a credencial em memória. Os resultados remotos só serão aprovados após receber
o novo relatório com quatro testes executados e aprovados.

Validação local pós-restauro executada nesta sessão:

- 184 testes aprovados em 26 ficheiros, incluindo sete testes da conexão
  read-only reservada e da identidade/PID usados pelo Drizzle.
- Quatro testes de integração real ignorados na suite local; exigem a ligação
  Preview introduzida com entrada oculta.
- 13 testes Python do restaurador e 12 testes Python do validador aprovados,
  incluindo extração de falhas individuais e supressão de mensagens sensíveis.
- TypeScript aprovado.
- ESLint: zero erros e um aviso preexistente em `src/app/layout.tsx`.
- Build Webpack pós-restauro aprovado numa cópia isolada sem credenciais:
  `/home/pablo/linha-post-restore-build-qfrxt9zk`.

Contagens, integridade e schema estão confirmados pelo relatório acima. Faltam
os resultados individuais das consultas reais; os testes locais não os substituem.

Para reproduzir exclusivamente a falha de integração:

```bash
python3 -B scripts/validate-preview.py --integration-only
```

## Validação exclusivamente de leitura

No terminal normal do NUC, executar:

```bash
cd '/home/pablo/Projects/SITE APOSTAS/quadrante'
python3 -B scripts/validate-preview.py
```

O validador pede apenas a connection string do Session Pooler com entrada
oculta. Não exige redigitar a referência. Não carrega `.env`, não grava credenciais e
recusa outro host, utilizador, referência, porta ou parâmetros de URI.
A CA é lida de `/home/pablo/Downloads/prod-ca-2021-novo.crt`; a ligação exige
`sslmode=verify-full`.

A referência é vinculada ao utilizador autenticado `postgres.<ref>` no pooler
oficial verificado por TLS. A resposta SQL verifica a base `postgres`, os papéis
`current_user` e `session_user` e transação read-only. O requisito TLS baseia-se
no sucesso de libpq com `verify-full`, CA e hostname fixos; GSS encryption é
desativada para não substituir TLS. `pg_stat_ssl` e a versão TLS do backend são
apenas informativos: descrevem a ligação pooler→PostgreSQL, não cliente→pooler.
Não se assume que o
PostgreSQL tenha um campo universal `project_ref`, nem que `postgres` isoladamente
identifique o projeto. Não é necessária uma Management API ou token adicional.

O validador verifica as 13 contagens, 12 relações de chave estrangeira,
duplicados das identidades externas, coerência entre épocas e competições,
colunas, constraints, índices parciais e a sequência do arquivo. Usa uma
transação read-only com snapshot consistente. Se passar, executa quatro testes
de consultas reais da aplicação, também com sessões read-only. Não executa
páginas com sincronização nem o tick do agente editorial.

O relatório contém metadata e agregados e é criado com permissões 0600 em
`/home/pablo/backups/linhadejogo/preview-validation-<id>.json`. Não contém
credenciais, dados pessoais ou conteúdo editorial. O caminho é mostrado como
`REPORT_PATH`. Não se publicam mensagens completas das ferramentas e SQL.

Para verificar exclusivamente o destino, sem analisar o backup nem escrever:

```bash
python3 -B scripts/restore-preview.py --verify-target
```

É possível validar apenas o arquivo, sem rede nem credenciais:

```bash
python3 -B scripts/restore-preview.py --check-only
python3 -B scripts/test_restore_preview.py
```

## Proteções e transação

- Backup fixo e verificado por SHA256, nunca modificado.
- As 13 tabelas e contagens são verificadas offline antes da ligação.
- Verificação remota read-only da identidade, SSL, colunas, tipos, nulabilidade,
  chaves, constraints e ausência de triggers/RLS inesperadas.
- Apenas o estado inicial conhecido é aceite: `sports` contém o futebol original
  e as outras 12 tabelas estão vazias. Dados existentes bloqueiam a execução.
- Uma transação reúne locks, nova verificação das contagens, DDL mínima, COPY,
  reinícios das 12 sequências e validação das contagens antes do commit.
- Os dados de `sports` são excluídos; o registo existente permanece.
- Não se executa `setval()`. `ALTER SEQUENCE ... RESTART WITH` preserva o próximo
  identificador e permite rollback. O par interno last_value/is_called difere
  transitoriamente do backup até ao próximo nextval.
- Não se desativam triggers ou constraints. COPY preserva IDs e colunas originais.
- Nenhum importador, agente, migração genérica ou provider é executado.
- Não existem retries automáticos. Se houver perda de ligação durante COMMIT,
  confirmar o estado por leitura antes de qualquer nova execução.
- A restauração não é um mecanismo de merge; conflitos exigem análise.

## Conteúdo esperado

| Tabela | Registos |
|---|---:|
| sports | 1 |
| competitions | 13 |
| seasons | 184 |
| teams | 377 |
| matches | 50.388 |
| standings | 212 |
| predictions | 9 |
| players | 116 |
| squad_entries | 116 |
| agent_cache | 0 |
| api_calls | 500 |
| evaluation_runs | 11 |
| sync_state | 114 |

Os jogos preservam as suas fontes: 3.750 Football-Data e 46.638 OpenFootball.
As listagens principais continuam a filtrar Football-Data; os dados históricos
não são renomeados nem fundidos artificialmente. A avaliação histórica conserva
a camada de consultas existente. O agente editorial continua a obter competições
e classificações através de `src/server/queries.ts`.

## Schema e publicação

`drizzle/0003_openfootball_archive.sql` reproduz as colunas provider_key anuláveis,
três índices únicos parciais e a sequência independente da origem. O utilitário
aplica esse ficheiro apenas à ligação Preview validada e dentro da transação de
recuperação. Não é adicionado ao runner genérico nem se inventa um ledger remoto.

O schema Drizzle representa os mesmos objetos. Isto exige que a restauração/DDL
esteja concluída antes de publicar esta versão contra a Preview. Qualquer futura
alteração de schema em Production ou publicação requer autorização própria.

A integração em execução, as páginas e os agentes só podem ser considerados
validados após comprovar a recuperação e testar o destino correto. A validação
offline e os testes com mocks não substituem essa comprovação.
