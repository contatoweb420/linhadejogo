# PostgreSQL no Preview — 2026-11-05

Branch: `preview/linhadejogo-2026-11-05`.

## Diagnóstico e limites da conclusão

O aviso «Base de dados em falta» é o fallback de todos os erros de
`pingDatabase()`, incluindo autenticação, TLS, DNS, timeout e esquema.
Não prova que `DATABASE_URL` esteja ausente. As páginas que o utilizam
estão marcadas `force-dynamic`; não é um aviso estático gerado no build.

O cliente anterior usava prepared statements automáticos, oito ligações por
instância, cinco segundos para ligar e nenhum TLS explícito. Com Transaction
Pooler Supabase, os prepared statements são uma incompatibilidade documentada.
A documentação atual também alerta que o pipelining do postgres.js com o
shared Transaction Pooler pode bloquear consultas ou devolver linhas incorretas;
`prepare: false` não resolve essa segunda limitação. Não usar `max_pipeline: 0`
como solução, pois pode quebrar transações.

Estas são falhas de configuração identificadas no código, **não uma confirmação
da causa do incidente remoto**. Não foi possível obter o erro do deployment nem
testar a sua ligação: esta sessão não tem `DATABASE_URL` Preview no processo,
o conector Supabase devolveu ferramenta indisponível, e a rede do shell não
resolve os serviços externos. Nenhum ficheiro de credenciais local/Production
foi carregado. A leitura real de `sports` e a confirmação das páginas no Preview
continuam pendentes.

## Solução escolhida

Manter Drizzle e postgres.js, sem dependências novas, com **Session Pooler
Supabase (5432)**. Embora Transaction Pooler seja normalmente apropriado para
serverless, a limitação específica deste driver justifica Session Pooler aqui.
Cada instância reutiliza um único pool, limitado a duas ligações, fecha ligações
inativas após 20 segundos e renova-as após 300 segundos. O número total continua
a depender do número de instâncias Vercel; observar os limites do pool Supabase.

Prepared statements estão desativados. A descoberta automática de tipos também:
o esquema atual usa tipos PostgreSQL incorporados e não precisa dessa consulta
adicional. O timeout para estabelecer a ligação é dez segundos. Nas ligações
remotas, TLS com `rejectUnauthorized: true` prevalece sobre opções na URI.
Não há alteração automática da porta, das credenciais ou de configurações externas.

`pg` com o adapter Drizzle correspondente seria uma alternativa se fosse
obrigatório manter Transaction Pooler. Essa mudança acrescentaria dependências
e exigiria validar todo o acesso à base de dados; não é necessária com Session
Pooler disponível. A configuração atual na porta 6543 recebe mitigação para
prepared statements, mas **não deve ser considerada a solução final** devido
ao pipelining documentado.

## Passos manuais na Vercel

1. No projeto Supabase **linhadejogo-preview**, abrir **Connect → Session pooler**
   e copiar a URI completa com a password devidamente codificada para URI.
   Usar o endpoint e utilizador desse painel; não trocar apenas a porta de um
   endereço sem confirmar os restantes campos.
2. Na Vercel, editar apenas `DATABASE_URL` em **Preview**, com o override da branch
   `preview/linhadejogo-2026-11-05`, usando essa URI (porta 5432). Não alterar
   Production. Não partilhar o valor nem colocá-lo em logs.
3. Fazer commit/push das alterações exclusivamente para a branch Preview e criar
   um novo deployment Preview dessa branch. Alterar uma variável não atualiza os
   deployments existentes. Não promover o deployment.
4. Abrir a página inicial e pesquisa no novo Preview. Confirmar que o aviso
   desaparece e que as consultas existentes funcionam, mesmo que algumas tabelas
   não tenham dados. A página inicial executa a leitura de saúde de `sports` antes
   das consultas. Não disparar sincronizações ou migrações para testar a ligação.
   Jogos, competições e páginas de detalhe podem executar ingestão automática
   existente; não usar essas rotas num teste estritamente de leitura.
5. Se persistir a falha, consultar os **Runtime Logs desse Preview** procurando
   `[database] health check failed`. A aplicação regista apenas categoria e código
   seguro, sem mensagem original, SQL, URI, hostname, passwords ou tokens.

| Categoria/código | Verificação necessária apenas no Preview |
| --- | --- |
| `configuration / DATABASE_URL_MISSING` | Override da branch, ambiente e novo deployment |
| `configuration / DATABASE_URL_INVALID` | Formato PostgreSQL, base, utilizador e escapes URI |
| `authentication / 28P01` ou `28000` | Utilizador do pooler e password do projeto Preview |
| `tls / …` | Certificado, cadeia de confiança, hostname e relógio; nunca desativar validação |
| `dns / ENOTFOUND` ou `EAI_AGAIN` | Endpoint do pooler e resolução DNS |
| `connectivity / …` | Rede, estado do projeto e limites de ligações |
| `timeout / CONNECT_TIMEOUT` | Estabelecimento da ligação; `57014` indica cancelamento da consulta |
| `pooler / 26000` ou `42P05` | Prepared statements e modo de pooling |
| `permissions / 42501` | Analisar privilégios antes de qualquer alteração autorizada |
| `schema / 42P01`, `42703` ou `3F000` | Projeto/base/esquema correto; não executar migrações por suposição |
| `database / …` ou `unknown / DATABASE_CHECK_FAILED` | Recolher mais evidência segura antes de concluir |

A leitura de saúde permanece `select id from sports limit 1`; zero linhas é
sucesso. Não foi criada uma rota pública de diagnóstico Preview. A rota
`/api/diagnostico-db` permanece inalterada, limitada a Production e protegida
pelo segredo existente. Não a utilizar para investigar Preview.

## Validação executada

- `npm test`: 21 ficheiros, 124 testes aprovados, incluindo configuração do driver
  instalado sem rede, classificação segura de erros, reutilização do cliente e
  comportamento da página inicial com mocks.
- `npx --no-install tsc --noEmit`: aprovado.
- `npm run lint`: sem erros; um aviso preexistente sobre fontes em `layout.tsx`.
- Build de produção: aprovado com `npm run build -- --webpack` e
  `LINHA_BUILD_IN_PROCESS=1`, numa cópia isolada sem `.env` nem variáveis de
  ligação. A primeira tentativa em `/tmp` falhou por erro de escrita `-122`;
  a repetição em `/home/pablo` terminou com sucesso.
- `git diff --check`: aprovado. Rota de diagnóstico, esquema, configuração de
  migrações e dependências inalterados.
- Ligação real ao Supabase Preview, leitura real de `sports` e ausência do aviso
  no site remoto: **não verificadas**. Os testes com mocks não as comprovam.
- Nenhum browser headless, migração, escrita na base de dados ou deployment foi
  executado. Production não foi consultada nem alterada.

## Referências consultadas

- [Supabase: postgres.js e aviso de pipelining](https://supabase.com/docs/guides/database/postgres-js)
- [Supabase: modos de ligação](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [postgres.js 3.4.9: opções, TLS e ciclo de vida](https://github.com/porsager/postgres/blob/v3.4.9/README.md)

O índice de changelog foi tentado, mas não ficou acessível nesta sessão;
a documentação acima foi consultada diretamente.
