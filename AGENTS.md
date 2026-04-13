Agent Architecture
repro is not a traditional single-prompt script, nor does it force you to manage raw API keys and token limits directly. Instead, it is built as a meta-orchestrator using a multi-agent system adapted from the ReAct (Reasoning and Acting) paradigm, specifically tailored for mobile UI exploration and stateful environments.

To handle the heavy cognitive lifting, repro leverages the AI coding agents you already have installed on your machine.

🤖 Local Agent Integration (Bring Your Own Agent)
Rather than reinventing the LLM execution layer, repro delegates complex reasoning tasks by hooking into your existing CLI workflows via subprocess execution.

Initially, repro supports native routing to the following locally installed AI CLIs:

Claude Code (claude)

Codex (codex)

OpenCode (opencode)

When repro needs to plan a test or evaluate a failure, it constructs a highly optimized prompt containing the bug description, UI View Tree, and logs, and pipes it directly into your preferred CLI. It then parses the standard output (stdout) to continue the autonomous loop.

🔄 The Autonomous Loop
The orchestrator and the delegated agents operate in a continuous cycle until the bug is reproduced or a maximum retry limit is reached. The lifecycle follows this sequence:

Bug Report ➔ Context Gatherer ➔ Planner (via CLI) ➔ Compiler ➔ State Manager ➔ Executor ➔ Observer ➔ Evaluator (via CLI) ➔ Refiner (via CLI) ➔ (Repeat)

Agent Roles and Responsibilities
Each component in the pipeline has a strict scope. repro handles the deterministic execution, while your installed AI CLI handles the cognition.

1. 👁️ Context Gatherer
   Type: Deterministic (Internal repro logic)
   Before any LLM intervention, this module grounds the system in reality. It prevents the Planner from hallucinating non-existent buttons by dumping the current state of the application.

Input: App binary and emulator connection.

Task: Extracts the View Tree and Accessibility IDs via Maestro.

Output: A clean, token-optimized JSON/XML representation of the current screen.

2. 🧠 Planner
   Type: Delegated High-Cognition (via claude, codex, or opencode)
   This is the strategic core of the system. repro invokes your local AI CLI to cross-reference the vague natural language bug description with the actual UI tree.

Input: Bug description, UI View Tree, and past failure context (piped to the CLI).

Task: Generates a step-by-step hypothesis of how to trigger the bug.

Output: A structured JSON intent describing the actions and expected UI changes.

3. 🛠️ Compiler
   Type: Deterministic (Internal repro logic)
   LLMs are prone to formatting errors. Instead of having the AI write YAML directly, the Compiler acts as a translation layer.

Input: JSON intent from the Planner.

Task: Translates the intent into perfectly formatted, executable Maestro YAML flows.

Output: Executable .yaml files.

4. 🧹 State & Fixture Manager
   Type: Deterministic (Internal repro logic)
   UI testing is stateful. If an agent logs in during attempt 1, attempt 2 will fail because the user is already logged in.

Task: Triggers deep links (e.g., app://dev/reset-state), clears app cache, or drops local databases before the next execution runs.

5. ⚡ Executor & Network Proxy
   Type: Environment Controller (Internal repro logic)
   This module physically interacts with the iOS/Android simulator and the network layer.

Task: Runs the Maestro flow and manipulates the network proxy (injecting artificial latency or HTTP 500s) as requested by the Planner's hypothesis.

6. 📡 Observer
   Type: Heuristic Monitor (Internal repro logic)
   A passive monitoring agent that watches the execution in real-time. It does not make decisions; it only collects evidence.

Input: Simulator logs (logcat / xcrun simctl), visual signals, and network payloads.

Task: Flags anomalies like silent crashes, UI freezes, or unexpected network errors.

Output: An "Execution Report" containing the exact sequence of events.

7. ⚖️ Evaluator
   Type: Delegated Fast-Cognition (via CLI)
   This agent acts as the judge. repro asks the local AI CLI to compare what was supposed to happen with what actually happened.

Input: Original bug description and Observer's Execution Report.

Task: Determines if the bug was successfully reproduced.

Output: Boolean (Reproduced: true/false) and a brief explanation.

8. 🔄 Refiner
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
- **Keep AGENTS.md updated** — Document architectural decisions here as they evolve
