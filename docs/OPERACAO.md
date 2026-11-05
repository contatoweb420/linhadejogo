# Operação e manutenção

## Arranque local

Pré-requisitos: Node.js com suporte a `--env-file`, npm, Docker e Docker Compose. Não existe versão de Node fixada no projeto; a auditoria foi executada com Node 26.7.0 e npm 11.19.0. Isto não comprova compatibilidade com todas as versões.

Dentro de `quadrante/`:

```bash
cp .env.example .env
cp .env.example .env.local
```

Editar os ficheiros antes de continuar: definir uma palavra-passe local própria no Compose e a mesma na `DATABASE_URL`. Colocar as chaves da aplicação em `.env.local`. Não voltar a copiar por cima de ficheiros já configurados.

```bash
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

Abrir `http://localhost:3001`. Reiniciar o processo depois de alterar variáveis. Se a base ainda estiver a iniciar, aguardar a disponibilidade do PostgreSQL e repetir a migração.

## Verificações

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

As configurações atuais excluem cópias temporárias em `.cache`; Vitest descobre apenas testes da pasta `src`. Os testes de browser têm configuração própria, descrita em [Testes locais](TESTES.md). Para analisar apenas os testes e código de origem:

```bash
npx vitest run --exclude '**/.cache/**'
npx eslint src scripts *.ts *.mjs
```

Este recorte não substitui uma compilação completa. Preservar os dados editoriais em `.cache` ao limpar artefactos temporários.

## Execução de produção

```bash
npm run build
npm run start -- --port 3001
```

`npm run dev` fixa a porta 3001; `npm run start` sozinho não a fixa. Definir as variáveis no ambiente de alojamento. Confirmar qual das duas pastas é a origem do deploy antes de publicar.

O armazenamento editorial atual exige disco gravável e persistente. Não assumir que a configuração funciona num ambiente com múltiplas instâncias ou disco efémero. A agenda implementada com temporizadores depende da vida do processo. Para esses ambientes, migrar os dados editoriais para armazenamento persistente e usar um agendador externo com exclusão de execuções concorrentes.

## Recolha e redação

Configurar um segredo forte em `RECOLHA_SEGREDO`. Um agendador pode fazer POST para `/api/recolha`, `/api/noticias` ou `/api/blog-agente`, enviando `x-recolha-segredo`. Não colocar o segredo na URL ou em logs.

Aceder à redação e rever texto, imagem, crédito, licença e data antes de publicar. A sessão atual tem limitações de caminho com os prefixos de idioma; consultar a auditoria. Os artigos publicados também podem ser atualizados pelo agente, pelo que a revisão inicial não garante imutabilidade.

## Backup e recuperação

```bash
npm run db:backup
```

O script atual usa o serviço Docker `postgres`, utilizador `quadrante` e base `quadrante` fixos. Não usa `DATABASE_URL` para escolher uma base remota. Se alterar os nomes no Compose, adaptar o procedimento antes de confiar no backup.

O backup SQL não inclui artigos, configuração editorial ou notícias. Conservar também `.cache/blog-agente/` e `.cache/noticias.json`, com acesso restrito e cópia externa ao computador. Parar as escritas durante a cópia dos JSON para obter um conjunto consistente.

Antes de qualquer restauro, identificar o destino e testar numa base descartável. Para um dump SQL simples criado por `pg_dump`, usar `psql` com paragem no primeiro erro, por exemplo `psql --set ON_ERROR_STOP=on --dbname "$RESTORE_DATABASE_URL" --file "$BACKUP_FILE"`, definindo ambas as variáveis para o ambiente de teste. O projeto ainda não tem script de restauro nem evidência de ensaio de recuperação.

## Diagnóstico

| Sintoma | Verificação |
| --- | --- |
| Dados indisponíveis | `DATABASE_URL`, disponibilidade do PostgreSQL e migrações |
| Recolha sem dados | Chave football-data, limites e resposta da origem |
| API devolve 404/401 | Cabeçalho e `RECOLHA_SEGREDO`; distinguir as famílias de endpoints |
| Notícias vazias | Configuração JSON das fontes e presença de `.cache/noticias.json` |
| Artigos desaparecem | Retenção de 40 artigos, persistência do disco e concorrência de escritas |
| Filtros desaparecem | Rewrite do proxy em `quadrante/src/proxy.ts` |
| Login editorial não persiste | Caminho do cookie `/redacao` versus URL com idioma |

Não executar migrações, importações ou restauros contra produção sem confirmar destino e ter backup. A auditoria não executou essas operações.
