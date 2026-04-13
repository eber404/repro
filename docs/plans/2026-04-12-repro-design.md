# repro Design

**Date:** 2026-04-12  
**Project:** Autonomous Bug Reproduction CLI

---

## Overview

repro is an AI-agent-based CLI tool that automatically reproduces bugs from natural language descriptions by iteratively exploring mobile app UI, executing test flows, and refining strategy until the bug is consistently reproduced.

---

## Architecture: Pipeline

```
BugReport → ContextGatherer → Planner → Compiler → StateManager → Executor → Observer → Evaluator → Refiner
                    ↑                                                                                      │
                    └────────────────────────────── (loop back if not reproduced) ────────────────────────┘
```

Each stage is a discrete function that receives a `ReproContext` object, does its work, and returns an updated context.

---

## Configuration

User sets defaults via `~/.repro/config.json` or `repro.config.json` in project root:

```json
{
  "appPath": "/path/to/app.apk",
  "platform": "android",
  "maestroSdk": true,
  "maxRetries": 5,
  "flowDir": "./flows",
  "resetStrategy": "clear-app-data"
}
```

**CLI usage:**
```bash
repro "app crashes on login"        # uses config defaults
repro "app crashes" --app ./app.ipa  # override specific value
```

**Precedence:** CLI flags > project config > global config

---

## Core Components

| Component | Responsibility | Type |
|-----------|---------------|------|
| `ContextGatherer` | Dump UI tree via Maestro SDK | Deterministic |
| `Planner` | Generate exploration strategy via CLI agent | Delegated (claude/codex/opencode) |
| `Compiler` | Translate JSON intent → Maestro YAML | Deterministic |
| `StateManager` | Reset app state between attempts (adb shell pm clear) | Deterministic |
| `Executor` | Run Maestro flow on device/simulator | Deterministic |
| `Observer` | Capture screenshots + device logs during execution | Deterministic |
| `Evaluator` | Judge if bug was reproduced | Delegated (CLI agent) |
| `Refiner` | Adjust strategy on failure | Delegated (CLI agent) |

**Agent routing:**
- Environment variable `REPRO_AGENT` (default: `claude`)
- `REPRO_EVAL_AGENT` for evaluator (default: same as planner)
- Agents invoked via `child_process.spawn` with stdout piped

---

## Data Flow

```typescript
BugDescription (string)
         ↓
ReproContext {
  bug: string
  appPath: string
  platform: 'android' | 'ios'
  maxRetries: number
  flowDir: string
  uiTree: JSON | null        // added by ContextGatherer
  plan: JSON | null          // added by Planner
  flowFile: string | null    // added by Compiler
  executionResult: Result | null   // added by Executor
  executionReport: Report | null   // added by Observer
  reproduced: boolean | null       // added by Evaluator
  refinement: JSON | null         // added by Refiner
}
         ↓
Stage functions:
  gatherContext(ctx) → ctx
  plan(ctx) → ctx
  compile(ctx) → ctx
  resetState(ctx) → ctx
  execute(ctx) → ctx
  observe(ctx) → ctx
  evaluate(ctx) → ctx
  refine(ctx) → ctx → (loop to plan or exit)
```

Each stage is a pure function that takes `ReproContext` and returns a new `ReproContext`.

---

## Error Handling

**Stage-level:** Each stage wraps in try/catch. On failure, context has `error` field with stage name and message. Pipeline halts and reports failure to user.

**Agent CLI failures:**
- Non-zero exit → treat as failure, include stderr in context error
- Timeout (default 60s) → kill process, mark as timeout error

**Executor failures:**
- Device disconnected → `ExecutorError`, offer to retry
- Maestro flow fails → capture failure YAML, continue to Observer

**Loop failures:**
- Max retries reached → exit with summary of attempts
- Unrecoverable error → exit early with error details

**Final output on failure:**
```
❌ Failed to reproduce after 3 attempts.

Attempt 2 error: "tapOn 'Login' timed out after 30s"
Last execution report: ./flows/attempt-2/report.json
```

---

## Output Artifacts

After successful reproduction:

| Artifact | Location | Description |
|----------|----------|-------------|
| YAML flow | `./flows/<bug-hash>.yaml` | Executable Maestro flow |
| Screenshots | `./flows/<bug-hash>/screenshots/` | Captured at failure points |
| Device logs | `./flows/<bug-hash>/logs/` | logcat/simctl output |
| Report | `./flows/<bug-hash>/report.json` | JSON summary with repro rate |

**Report structure:**
```json
{
  "bugDescription": "app crashes on login",
  "reproRate": "4/5",
  "flowFile": "./flows/abc123.yaml",
  "hypothesis": "Race condition in navigation unmount",
  "attempts": 5,
  "screenshotsDir": "./flows/abc123/screenshots",
  "logsDir": "./flows/abc123/logs"
}
```

---

## Platform Detection

- **Android:** Use `adb` for device communication, `adb shell pm clear` for state reset, `logcat` for device logs
- **iOS:** Use Xcode simulator tools, `xcrun simctl` for state reset, `simctl diagnose` for logs
- Auto-detect based on app binary extension (.apk → android, .ipa → ios)
- Allow override via `--platform` flag

---

## CLI Interface

```bash
# Basic usage (uses config defaults)
repro "app crashes on login"

# Override specific config values
repro "app crashes" --app ./build/app.ipa
repro "payment fails" --retries 10

# Show help
repro --help

# Show version
repro --version
```

---

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **CLI Parsing:** Bundled (Bun built-in or picocolors for output)
- **Agent Integration:** child_process.spawn with stdout piping
- **Maestro:** @maestro/core SDK
- **Testing:** Bun test

---

## File Structure

```
repro/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── config.ts          # Config loading
│   ├── context.ts         # ReproContext type
│   ├── pipeline.ts        # Main pipeline orchestrator
│   ├── stages/
│   │   ├── gatherContext.ts
│   │   ├── planner.ts
│   │   ├── compiler.ts
│   │   ├── stateManager.ts
│   │   ├── executor.ts
│   │   ├── observer.ts
│   │   ├── evaluator.ts
│   │   └── refiner.ts
│   ├── agents/
│   │   └── cli.ts         # Agent invocation via spawn
│   ├── platform/
│   │   ├── android.ts     # Android-specific logic
│   │   └── ios.ts         # iOS-specific logic
│   └── utils/
│       └── output.ts      # Report generation
├── flows/                  # Generated YAML flows
├── docs/
│   └── plans/             # Design documents
├── repro.config.json      # Project config
├── package.json
└── tsconfig.json
```