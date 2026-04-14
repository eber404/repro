# Design: login bootstrap com contexto visual

**Data:** 2026-04-13  
**Status:** Aprovado para planejamento de implementacao

## Objetivo

Refatorar o pipeline para:

1. Aprimorar a descricao de bug recebida via CLI usando LLM.
2. Validar deterministicamente se o Maestro consegue abrir o app em estado limpo (preflight).
3. Sempre coletar contexto visual atual (hierarchy + screenshot).
4. Sempre enviar contexto visual para LLM.
5. Executar login bootstrap via YAML gerado por LLM apenas quando `REPRO_APP_EMAIL` e `REPRO_APP_PASSWORD` estiverem configuradas.

## Fluxo alvo

```text
CLI bug description
  -> enhanceBugDescription (LLM)
  -> verifyAppLaunch (preflight deterministico)
  -> gatherVisualContext (maestro hierarchy + screenshot)
  -> analyzeScreenWithAi (LLM; sempre)
  -> executeLoginBootstrap (somente com credenciais)
  -> planner -> compiler -> stateManager -> executor -> observer -> evaluator -> refiner
```

## Decisoes confirmadas

- O estagio de AI que recebe `uiTree + screenshot` existe sempre, em toda tentativa.
- A diferenca com credenciais e somente habilitar a geracao e execucao de flow de login antes da reproducao do bug.
- O output do step 1 (aprimoramento de bug) sera texto simples (`string`), nao JSON estruturado.
- Screenshot deve ser coletado sempre, em toda tentativa.
- Com credenciais, falha em gerar YAML valido de login ou falha ao executar login bootstrap e fatal e encerra o processo com graceful shutdown.

## Componentes e contratos

### 1) `enhanceBugDescription` (novo, sempre)

- Entrada: `ctx.bug` (texto original da CLI).
- Saida: `ctx.enhancedBugDescription` (texto refinado).
- Regra: manter `ctx.bug` original para rastreabilidade.

### 2) `verifyAppLaunch` (existente, obrigatorio)

- Continua como gate deterministico antes de estagios cognitivos seguintes.
- Falha e nao-retentavel para tentativa/processo.

### 3) `gatherVisualContext` (evolucao de `gatherContext`, sempre)

- Captura `maestro hierarchy`.
- Captura screenshot da tela visivel.
- Saida: `ctx.uiTree` e `ctx.visibleScreenshotPath`.

### 4) `analyzeScreenWithAi` (novo, sempre)

- Entrada: `uiTree + screenshot + enhancedBugDescription`.
- Saida base: `ctx.screenAnalysis`.
- Saida condicional com credenciais: `ctx.loginBootstrapYaml` (flow Maestro de login).

### 5) `executeLoginBootstrap` (novo, condicional)

- Gate: roda apenas quando `email && password`.
- Executa YAML retornado por `analyzeScreenWithAi` antes do planner principal.
- Falha com credenciais: fatal e nao-retentavel.

### 6) Ajuste no planner

- Planner usa `enhancedBugDescription` como fonte principal de bug.
- Planner tambem recebe `screenAnalysis` e `uiTree` como contexto de apoio.

## Data flow no contexto

Campos novos/ajustados no `ReproContext`:

- `enhancedBugDescription?: string`
- `visibleScreenshotPath?: string`
- `screenAnalysis?: string | object`
- `loginBootstrapYaml?: string`

Campos existentes relevantes:

- `bug` (original)
- `uiTree`
- `credentials`
- `flowDir`, `flowFile`, `attempt`, `error`, `reproduced`

## Politica de erro e graceful shutdown

### Falhas fatais imediatas

- `verifyAppLaunch` falhar.
- `analyzeScreenWithAi` falhar quando credenciais exigirem YAML de login.
- `loginBootstrapYaml` invalido quando credenciais estiverem presentes.
- `executeLoginBootstrap` falhar com credenciais.

### Comportamento sem credenciais

- `executeLoginBootstrap` e skip explicito.
- Ausencia de YAML de login nao e erro.

### Encerramento gracioso

- Persistir erro com nome do estagio e detalhes de stdout/stderr relevantes.
- Finalizar subprocessos/timers ativos.
- Preservar artefatos ja coletados para diagnostico.

## Artefatos por tentativa

Diretorio (sibling layout): `flows/<run-timestamp>/attempt-N/`

- `flow.yaml` (reproducao do bug)
- `visible-screen.png` (screenshot atual)
- `login-bootstrap.yaml` (somente com credenciais)
- `logs/` (logs do dispositivo e execucao)

## Testes planejados

- Unit
  - `enhanceBugDescription` (sucesso, timeout, parse de resposta)
  - validacao de YAML de login
  - gate estrito de credenciais
- Stage/integ
  - `gatherVisualContext` (hierarchy + screenshot)
  - `analyzeScreenWithAi` (sempre roda)
  - `executeLoginBootstrap` (somente com credenciais)
- Pipeline
  - sem credenciais: fluxo segue sem bootstrap
  - com credenciais e YAML valido: bootstrap antes do planner
  - com credenciais e YAML invalido/falha de execucao: stop early fatal
  - preflight falha: stop early fatal sem prosseguir com estagios seguintes

## Trade-offs aceitos

- Mais estagios explicitos em troca de maior observabilidade, testabilidade e clareza operacional.
- Custo extra de screenshot por tentativa em troca de contexto visual consistente e melhor depuracao.
- Politica fatal no bootstrap de login com credenciais para evitar tentativas inconsistentes e nao deterministicas.

## Requisitos adicionais confirmados pelo usuario

- Remover codigo lixo/dead code durante a refatoracao, sem alterar fluxos gerados historicos.
- Atualizar `AGENTS.md` ao final da implementacao para refletir o novo fluxo e regras de falha.

## Proximo passo

Invocar skill `writing-plans` para gerar plano detalhado de implementacao sem iniciar codificacao ainda.
