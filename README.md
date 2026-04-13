repro 🐛🤖
Autonomous Bug Reproduction CLI

repro is an AI-agent-based command-line tool that automatically reproduces bugs from vague natural language descriptions.

Instead of relying on manual steps—often incomplete or inaccurate—written by QA, developers, or end users, repro interprets the bug report, explores the app’s behavior (iOS/Android), manipulates the environment, and discovers the exact path needed to reproduce the issue consistently, generating reusable E2E tests in the process.

🛑 The Problem
Developers waste valuable time trying to reproduce vague issues such as:

“Sometimes the app crashes after login”
“It failed when I tried to pay”

Even when reproduction steps exist, they may miss critical details about state, network conditions, or timing. The result is frustration, lost time, and bugs being closed as “Cannot Reproduce.”

💡 The Solution
repro turns guesswork into autonomous investigation. You provide a simple description, and it runs an iterative process that searches the space of UI interactions and network conditions:

bash
$ repro "app crashes after login when I go back quickly" --app ./build/app.apk
What it returns:

Exact human-readable reproduction steps.

An executable Maestro flow (.yaml) ready to use in CI/CD.

A repro rate showing consistency across runs.

Visual evidence such as screenshots, video, and system logs.

The exact stack trace (through telemetry integration) and a root-cause hypothesis.

⚙️ How It Works (Architecture)
The system does not run tests linearly. It operates as an autonomous agent loop, actively searching for the failure.

repro is built around the following specialized modules:

👁️ Context Gatherer: Before guessing flows, it extracts the current app element tree (View Tree / Accessibility IDs) through Maestro so planning is grounded in the actual UI.

🧠 Planner: Transforms the bug description and UI context into an exploration strategy or hypothesis.

🛠️ Compiler: Converts the Planner’s intent into executable Maestro flows.

🧹 State & Fixture Manager: Ensures isolation between attempts by resetting state, clearing app data, or triggering reset deep links so state mutations do not break the loop.

⚡ Executor & Network Proxy: Runs the flows on an emulator or real device and injects network anomalies such as artificial latency or HTTP 500 responses.

📡 Observer: Collects visual signals, system logs (logcat / simctl), and correlates actions with telemetry events.

⚖️ Evaluator: Decides, through deterministic checks or LLM reasoning, whether the original bug was successfully reproduced.

🔄 Refiner: If reproduction fails, it adjusts the strategy—for example, “try scrolling before going back”—and restarts the loop.

Lifecycle loop:

Bug ➔ Context ➔ Plan ➔ Reset State ➔ Execute ➔ Observe ➔ Evaluate ➔ Refine ➔ Repeat

🚀 Key Features & Differentiators
Autonomous Path Discovery: It does not just execute predefined tests. It dynamically discovers how to break the app.

Smart LLM Routing: Optimized for cost and speed. It uses stronger models only for the Planner and Refiner, while relying on faster heuristics or lighter models for the Observer and Evaluator.

Declarative by Design: Built on top of Maestro CLI, generating robust YAML flows instead of fragile coordinate-based scripts.

Network and Latency Manipulation: It can simulate slow connections or API failures to expose bugs that do not appear in ideal development environments.

Sentry / Crashlytics Integration: It correlates the emulator crash timestamp with the remote stack trace, giving developers not only the failure video, but the exact line of code involved.

💻 Example Output
When repro successfully finds the bug, it generates a ready-to-run test artifact like this:

text

# repro-generated: crash-login-fast-back.yaml

# Repro Rate: 4/5 (80% consistency)

# Hypothesis: Race condition in React Navigation unmount when auth state is pending.

## appId: com.example.app

- clearState: true
- launchApp
- tapOn: "Email Input"
- inputText: "test@repro.dev"
- tapOn: "Password Input"
- inputText: "password123"
- tapOn: "Login Button"
- assertVisible: "Loading Indicator"

# Repro discovery: The crash only occurs if back is pressed within 200ms of loading

- pressKey: back
  🔧 Use Cases
  repro is flexible and can be integrated into multiple stages of the development lifecycle:

Local CLI: Used directly by developers to investigate Jira tickets.

Pull Request / Issue Bot: Watches GitHub issues, attempts reproduction in the cloud, and comments back with the generated video and YAML flow when successful.

Code-Fixing Agents: Works as a validation layer for autonomous coding agents that not only identify the bug, but also verify whether a generated fix actually resolves the problematic flow.

Built to transform vague bug reports into reproducible, actionable, and fixable scenarios.

If you want, I can also turn this into a more polished GitHub-style README with sections like Installation, Usage, CLI Options, Roadmap, and Contributing.
