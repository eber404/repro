Agent Architecture
repro is not a traditional single-prompt script, nor does it force you to manage raw API keys and token limits directly. Instead, it is built as a meta-orchestrator using a multi-agent system adapted from the ReAct (Reasoning and Acting) paradigm, specifically tailored for mobile UI exploration and stateful environments.

To handle the heavy cognitive lifting, repro leverages the AI coding agents you already have installed on your machine.

🤖 Local Agent Integration (Bring Your Own Agent)
Rather than reinventing the LLM execution layer, repro delegates complex reasoning tasks by hooking into your existing CLI workflows via subprocess execution.

Initially, repro supports native routing to the following locally installed AI CLIs:

- **Claude Code** (claude) - Default
- Gemini CLI (gemini)
- Codex (codex)
- OpenCode (opencode)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPRO_AGENT` | `claude` | Default agent for Planner and Refiner (claude, gemini, codex, opencode) |
| `REPRO_EVAL_AGENT` | `REPRO_AGENT` | Agent specifically for Evaluator |
| `REPRO_LOGIN_AGENT` | `REPRO_AGENT` | Agent specifically for visual screen analysis/login bootstrap |
| `REPRO_APP_EMAIL` | - | App login email (loaded from `.env`) |
| `REPRO_APP_PASSWORD` | - | App login password (loaded from `.env`) |

### Agent Selection

```bash
# Use Claude (default)
REPRO_AGENT=claude repro

# Use Claude for planning, Gemini for evaluation
REPRO_AGENT=claude REPRO_EVAL_AGENT=gemini repro

# Use Gemini for planning and evaluation
REPRO_AGENT=gemini repro
```

### App Credentials

Create a `.env` file in the project root:

```bash
REPRO_APP_EMAIL=your@email.com
REPRO_APP_PASSWORD=yourpassword
```

These credentials are passed to the Planner when the app requires authentication.

When repro needs to plan a test or evaluate a failure, it constructs a highly optimized prompt containing the bug description, UI View Tree, and logs, and pipes it directly into your preferred CLI. It then parses the standard output (stdout) to continue the autonomous loop.

🔄 The Autonomous Loop
The orchestrator and delegated agents operate in a continuous cycle until the bug is reproduced or max retries is reached. The lifecycle follows this sequence:

Bug Report ➔ Bug Enhancer (AI) ➔ Preflight ➔ Visual Context Gatherer (hierarchy + screenshot) ➔ Screen Analyzer (AI) ➔ Login Bootstrap Executor (conditional) ➔ Planner (AI) ➔ Compiler ➔ State Manager ➔ Executor ➔ Observer ➔ Evaluator (AI) ➔ Refiner (AI) ➔ (Repeat)

Agent Roles and Responsibilities
Each component in the pipeline has a strict scope. repro handles the deterministic execution, while your installed AI CLI handles the cognition.

1. ✍️ Bug Enhancer
   Type: Delegated (via local AI CLI)

Input: raw bug description from CLI.

Task: Improve wording for planning while preserving intent and original language.

Output: `enhancedBugDescription` used by planner.

2. 🔎 Preflight
   Type: Deterministic (Internal repro logic)

Input: appId, platform, deviceId, maestroPath.

Task: Run a minimal `preflight.yaml` that only launches the app with clean state.

Output: pass/fail gate before heavy stages.

Failure policy:
- Preflight failure is fatal for the attempt/process.
- No further cognitive stages run for that attempt.

3. 👁️ Visual Context Gatherer
   Type: Deterministic (Internal repro logic)
   Before any LLM intervention, this module grounds the system in reality. It prevents the Planner from hallucinating non-existent buttons by dumping the current state of the application.

Input: App binary and emulator connection.

Task: Run `maestro hierarchy` and capture a visible screenshot every attempt.

Output: Parsed UI tree plus screenshot path in attempt artifacts.

4. 🖼️ Screen Analyzer
   Type: Delegated (via local AI CLI)

Input: UI tree + visible screenshot + enhanced bug description.

Task: Return screen analysis always; when credentials exist, also return a login bootstrap Maestro YAML.

Output:
- always: `screenAnalysis`
- conditional: `loginBootstrapYaml`

Hard rule:
- No heuristic selector guessing for login.
- Login bootstrap must be AI-derived from runtime visual context.

5. 🔐 Login Bootstrap Executor
   Type: Deterministic (Internal repro logic)

Input: credentials gate + AI-generated login YAML.

Task: Execute login bootstrap before planner flow when both `REPRO_APP_EMAIL` and `REPRO_APP_PASSWORD` are present.

Failure policy:
- With credentials configured, missing/invalid YAML or Maestro bootstrap failure is fatal.
- Without credentials, bootstrap stage is skipped by design.

6. 🧠 Planner
   Type: Delegated High-Cognition (via claude, codex, or opencode)
   This is the strategic core of the system. repro invokes your local AI CLI to cross-reference the vague natural language bug description with the actual UI tree.

Input: Bug description, UI View Tree, and past failure context (piped to the CLI).

Task: Generates a step-by-step hypothesis of how to trigger the bug.

Output: A structured JSON intent describing the actions and expected UI changes.

7. 🛠️ Compiler
   Type: Deterministic (Internal repro logic)
   LLMs are prone to formatting errors. Instead of having the AI write YAML directly, the Compiler acts as a translation layer.

Input: JSON intent from the Planner.

Task: Translates the intent into perfectly formatted, executable Maestro YAML flows.

Output: Executable .yaml files.

8. 🧹 State & Fixture Manager
   Type: Deterministic (Internal repro logic)
   UI testing is stateful. If an agent logs in during attempt 1, attempt 2 will fail because the user is already logged in.

Task: Triggers deep links (e.g., app://dev/reset-state), clears app cache, or drops local databases before the next execution runs.

9. ⚡ Executor & Network Proxy
   Type: Environment Controller (Internal repro logic)
   This module physically interacts with the iOS/Android simulator and the network layer.

Task: Runs the Maestro flow and manipulates the network proxy (injecting artificial latency or HTTP 500s) as requested by the Planner's hypothesis.

10. 📡 Observer
   Type: Heuristic Monitor (Internal repro logic)
   A passive monitoring agent that watches the execution in real-time. It does not make decisions; it only collects evidence.

Input: Simulator logs (logcat / xcrun simctl), visual signals, and network payloads.

Task: Flags anomalies like silent crashes, UI freezes, or unexpected network errors.

Output: An "Execution Report" containing the exact sequence of events.

11. ⚖️ Evaluator
   Type: Delegated Fast-Cognition (via CLI)
   This agent acts as the judge. repro asks the local AI CLI to compare what was supposed to happen with what actually happened.

Input: Original bug description and Observer's Execution Report.

Task: Determines if the bug was successfully reproduced.

Output: Boolean (Reproduced: true/false) and a brief explanation.

12. 🔄 Refiner
   Type: Delegated High-Cognition (via CLI)
   If the Evaluator determines the bug was not reproduced, the Refiner takes over. repro feeds the entire failed loop back into the AI CLI to adjust the strategy.

Input: The failed plan, Execution Report, and Evaluator's reasoning.

Task: Identifies why the hypothesis failed (e.g., "The UI loaded too fast").

Output: A refined strategy fed back into the Planner for the next iteration.

Delegation Routing Strategy
Because repro relies on your installed CLIs, you have total control over the models and routing. For instance, you can configure repro to use a heavy model for the Planner and a faster, cheaper model for the Evaluator, depending on how you configure your local CLI aliases:

Heavy Lifting: Pass --agent=claude to use Anthropic's Claude 3.5 Sonnet (via Claude Code) for the Planner and Refiner, ensuring deep reasoning for complex state mutations.

Fast Validation: Pass --eval-agent=codex to use a smaller, faster model specifically for the Evaluator, saving time and token costs during the verification phase.

---

## Development Guidelines

These rules apply to all code written in this project:

- **No nested ifs** — Flatten control flow, prefer early returns
- **No nested ternaries** — Use readable, simple expressions
- **Prefer const** — Use const by default, let only when mutation is needed
- **No magic numbers** — Extract to named constants
- **Clean variable names** — Name things clearly; avoid abbreviations
- **Path aliases** — Use `@/*` imports (e.g., `@/agents/cli`) over relative paths
- **Avoid if-else chains when possible** — Use map/object lookup or early return patterns
- **Bun-first** — Leverage Bun's built-in APIs; no heavy Node.js polyfills
- **Preflight is mandatory** — Fail fast when Maestro cannot launch app cleanly
- **Visual context is mandatory** — Capture hierarchy + visible screenshot every attempt
- **AI login bootstrap gate** — Only execute login bootstrap when both app credentials are configured
- **No heuristic login selector detection** — Login automation must come from AI analysis of runtime visual context
- **Keep AGENTS.md updated** — Document architectural decisions here as they evolve
