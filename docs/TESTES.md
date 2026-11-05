# Testes locais

## Instalação e comandos

Na pasta `quadrante`, com Node.js e npm instalados:

```bash
npm ci
npm run test:e2e:setup
npm test
npm run test:e2e
```

`test:e2e:setup` instala `@playwright/test` como dependência de desenvolvimento, atualiza `package.json` e `package-lock.json`, e descarrega o Chromium correspondente. Depois da primeira instalação, conservar essas alterações no controlo de versões; outros computadores podem usar `npm ci` e `npx --no-install playwright install chromium`.

Esta etapa exige acesso ao registo npm e ao servidor de distribuição dos browsers. A tentativa inicial nesta sessão ficou bloqueada por DNS (`EAI_AGAIN` para `registry.npmjs.org`). Entretanto, o workspace passou a incluir `@playwright/test` 1.64.1 no `package-lock.json`; os ambientes seguintes devem usar `npm ci` e instalar o Chromium correspondente, sem voltar a resolver a versão da dependência.

Se o Chromium indicar bibliotecas do sistema em falta, consultar o diagnóstico apresentado pelo Playwright. Em distribuições suportadas, `npx --no-install playwright install --with-deps chromium` também trata dessas dependências; noutros sistemas, usar os pacotes indicados para a distribuição.

Para acompanhar os testes no computador:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:report
```

Para executar um ficheiro ou cenário:

```bash
npm run test:e2e -- tests/e2e/navigation.spec.mjs --project=chromium
npm run test:e2e -- --grep "calendar date" --project=chromium
```

## Como funciona o isolamento

- O Playwright inicia e encerra o seu próprio Next.js em `http://127.0.0.1:3101`; não reutiliza um servidor já aberto.
- A porta 3001 de desenvolvimento continua disponível para trabalho manual.
- A compilação de desenvolvimento dos testes fica em `.next-e2e`, separada de `.next`.
- O launcher fornece `DATABASE_URL` vazia, substitui as chaves dos fornecedores por valores vazios e impede diagnóstico de produção. Não liga à base local ou de produção.
- `E2E_TEST_MODE=1` desativa a agenda editorial no processo de testes.
- `BLOG_AGENT_DATA_DIR` aponta para uma pasta temporária exclusiva, inicialmente com artigos e execuções vazios; é removida ao terminar normalmente o servidor ou ao receber SIGINT/SIGTERM.
- O segredo editorial é um valor público de teste definido no launcher. Nunca é uma credencial real.
- Os browsers bloqueiam pedidos a origens externas, incluindo fontes e imagens. Isto não é uma interceção de pedidos do servidor: a ausência de chaves e base de dados controla esse lado do fluxo.
- Cada teste recebe um contexto de browser novo. Os testes correm com um worker e sem repetição automática, para facilitar o diagnóstico.

Não definir `E2E_TEST_MODE` no alojamento normal. `BLOG_AGENT_DATA_DIR` é uma opção do armazenamento editorial; quando omitida, a aplicação continua a usar `.cache/blog-agente`.

## Cobertura inicial

Existem 21 cenários, executados em dois projetos: Chromium desktop e Chromium com perfil de telemóvel Pixel 7. A emulação móvel valida viewport, toque e navegação; não substitui um aparelho real ou testes WebKit/Safari.

| Ficheiro | Verifica |
| --- | --- |
| `navigation.spec.mjs` | Redirecionamento inicial, navegação pelos menus desktop/mobile, estado sem base e página inexistente |
| `locales-and-filters.spec.mjs` | Idioma do HTML, seletor ativo, preferência persistente, data do calendário e pesquisa com reload |
| `editorial.spec.mjs` | Bloqueio sem sessão, rejeição de segredo errado e persistência da sessão correta |
| `api.spec.mjs` | Recusa de pedidos sem autorização e indisponibilidade do diagnóstico fora de produção |

Os testes verificam conteúdo renderizado, não apenas a URL do browser. Isso permite detetar a perda de filtros durante o rewrite do servidor. Erros JavaScript não tratados no browser também fazem falhar o teste.

## Regressões conhecidas

A suite foi escrita para o comportamento desejado, sem marcar os problemas da auditoria como aprovados ou ignorados. Pode falhar enquanto esses problemas existirem:

- **A02:** cookie da redação limitado a `/redacao`, incompatível com o prefixo de idioma; afeta o cenário de sessão correta.
- **A04:** rewrite perde a query string; afeta data do calendário, pesquisa e mensagem de acesso recusado.
- **A05:** idioma colocado na resposta em vez do pedido; os cenários de idioma verificam este possível problema em execução.

Consultar [a auditoria](AUDITORIA-2026-11-03.md) antes de alterar as expectativas. Uma falha deve conduzir à correção do comportamento ou à revisão fundamentada do requisito.

## Relatórios e diagnóstico

O relatório HTML fica em `playwright-report/`. Falhas conservam screenshot, vídeo e trace em `test-results/`. Para abrir um trace específico:

```bash
npx --no-install playwright show-trace test-results/<pasta-do-teste>/trace.zip
```

Estas pastas e `.next-e2e` estão ignoradas no Git. As configurações de Vitest, ESLint e TypeScript excluem as cópias temporárias em `.cache`; Vitest descobre apenas testes `src/**/*.test.ts` e `src/**/*.test.tsx`.

## Limites e próximas etapas

Esta primeira suite usa o servidor real de desenvolvimento, sem dados desportivos. Não valida a aplicação ligada a PostgreSQL, o sucesso das recolhas externas, aprovação/agendamento/publicação de artigos, nem o build de produção. Essas etapas exigem fixtures editoriais e uma base de teste dedicada; nunca usar a base pessoal para operações de limpeza.

A validação próxima de produção deve correr posteriormente contra `next build` e `next start`, conservando o mesmo isolamento. Não basta mudar para um servidor manual sem controlar as suas variáveis.

## Validação nesta sessão

Os ficheiros `.mjs` passaram a verificação de sintaxe do Node. `npm test` passou com 13 ficheiros e 51 testes, e `npx tsc --noEmit` terminou com sucesso. `npm run lint` passou sem erros, com um aviso preexistente sobre fontes em `src/app/layout.tsx:68`. A execução E2E ficou bloqueada por dois limites do ambiente: o download npm falhou com `EAI_AGAIN` e o arranque do servidor foi recusado com `listen EPERM` na porta 3101. Por isso, não existe resultado de browser aprovado nesta sessão.

## GitHub Actions

O workflow [Testes](../.github/workflows/tests.yml) pertence à raiz Git de `quadrante`, não à pasta superior do workspace. Executa em cada push, pull request e também manualmente em **Actions → Testes → Run workflow**, depois de estar na branch predefinida.

Tem dois jobs independentes em Ubuntu 24.04 e Node.js 24:

1. **Lint, TypeScript e testes unitários:** instalação com `npm ci`, lint, verificação de tipos e Vitest.
2. **Playwright desktop e telemóvel:** instalação pelo lockfile, Chromium com bibliotecas do sistema e execução dos dois projetos Playwright.

Não usa secrets, PostgreSQL ou serviços externos de futebol. O launcher preserva o isolamento local já descrito. Usa cache npm, permissões de leitura do repositório e cancela execuções anteriores do mesmo grupo quando chegam novas alterações.

O Playwright emite anotações de falhas no GitHub e um relatório HTML. Mesmo quando os testes falham, o job tenta guardar `playwright-report/` e `test-results/` como um artefacto durante 14 dias. Abrir a execução em Actions e descarregar **playwright-results-…**. Uma execução cancelada ou interrompida por timeout pode não conservar esses artefactos.

Os problemas conhecidos continuam a fazer falhar os testes correspondentes; o workflow não esconde essas falhas. O build de produção e testes com base de dados permanecem fora desta primeira configuração.

Para ativar, incluir no mesmo commit o workflow, a configuração Playwright, os testes, o launcher, as alterações de isolamento e `package.json`/`package-lock.json`, e enviar para o GitHub. Criar o YAML localmente não executa o serviço remoto. Esta revisão não fez push nem iniciou uma execução no GitHub.

Validação local desta configuração: YAML analisado com sucesso, consistência da dependência Playwright no lockfile confirmada e descoberta de 42 testes em quatro ficheiros verificada com `playwright test --list`. Esta descoberta não executa os cenários de browser.

Referência: [Playwright — Continuous Integration](https://playwright.dev/docs/ci).
