# repro - Autonomous Bug Reproduction CLI

**repro** is a CLI tool that automatically reproduces bugs in mobile apps using AI. Just describe the bug, and repro will find the exact steps to reproduce it.

## What it does

Instead of spending hours trying to figure out how to reproduce a bug, repro does it for you:

1. Takes a bug description like *"app crashes after login when pressing back quickly"*
2. Launches the app on a simulator/emulator
3. Uses AI to explore different scenarios
4. Finds the exact steps to reproduce the bug
5. Generates a reusable test flow you can run anytime

## Requirements

- **Maestro** - Install from [maestro.dev](https://maestro.dev) or use the bundled version in `maestro/` directory
- **iOS Simulator** (for iOS apps) or **Android Emulator** (for Android apps)
- **AI Agent** - Currently supports: **claude** (default), gemini, codex, opencode

## Quick Start

### 1. Start an emulator

```bash
# iOS
open -a Simulator

# Android
emulator -avd <avd_name>
```

### 2. Create `.env` file (optional, for apps requiring login)

```bash
REPRO_APP_EMAIL=your@email.com
REPRO_APP_PASSWORD=yourpassword
```

### 3. Run repro

**Interactive mode:**
```bash
repro --interactive
```

**Direct mode:**
```bash
repro "bug description here" --device "iPhone 16e" -app "com.example.app"
```

## Usage

```bash
# Show help
repro --help

# Interactive mode (prompts for all options)
repro --interactive
repro -i

# Direct mode (all options on command line)
repro "app crashes on login" --device "iPhone 16e" -app "com.example.app"

# With Android
repro "button doesn't work" --device "Android Emulator" -app "com.example.app"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `REPRO_AGENT` | AI agent for planning (claude, gemini, codex, opencode). Default: claude |
| `REPRO_EVAL_AGENT` | AI agent for evaluation. Default: same as REPRO_AGENT |
| `REPRO_LOGIN_AGENT` | AI agent for visual screen analysis/login bootstrap. Default: same as REPRO_AGENT |
| `REPRO_APP_EMAIL` | App login email (from .env) |
| `REPRO_APP_PASSWORD` | App login password (from .env) |

## How it Works

```
Bug Description
  → Enhance Bug Description (AI)
  → Preflight (Maestro clean launch gate)
  → Gather Visual Context (hierarchy + screenshot)
  → Screen Analysis (AI, always)
  → Login Bootstrap (AI YAML, only with credentials)
  → Planner → Compiler → State Manager → Executor → Observer → Evaluator → Refiner
```

1. **Enhance Bug Description (AI)** - Refines the CLI bug text without changing intent
2. **Preflight** - Verifies Maestro can launch the app cleanly before execution
3. **Gather Visual Context** - Captures `maestro hierarchy` plus visible screenshot every attempt
4. **Screen Analysis (AI)** - Uses hierarchy + screenshot to produce runtime screen analysis
5. **Login Bootstrap** - Runs AI-generated login YAML only when both credentials are configured
6. **Planner/Compiler/Executor loop** - Plans repro, compiles YAML, executes, observes, evaluates, and refines

### Fatal stop rules

- Preflight failure stops the attempt/process immediately (non-retryable).
- With credentials configured, invalid/missing login YAML or bootstrap execution failure is fatal.

## Output

After running, repro creates:

```
flows/
└── 2026-04-13_10-30-00/
    ├── preflight.yaml
    └── attempt-1/
        ├── visible-screen.png  # Current visible screen capture
        ├── login-bootstrap.yaml # Generated only with credentials
        ├── flow.yaml           # Executable bug reproduction flow
        └── logs/               # Device/runtime logs
```

## Examples

**Login bug:**
```bash
repro "user gets redirected to login twice after logging out" --device "iPhone 16e" -app "com.example.app"
```

**Crash on navigation:**
```bash
repro "app crashes when going back from settings" --device "Android Emulator" -app "com.example.app"
```

**Payment issue:**
```bash
repro "payment fails when card is expired" --device "iPhone 16e" -app "com.example.app"
```

## Troubleshooting

**No devices found:**
- Make sure an emulator/simulator is running
- iOS: `open -a Simulator`
- Android: Start an AVD from Android Studio or command line

**Login bootstrap fails:**
- Ensure `.env` file has correct `REPRO_APP_EMAIL` and `REPRO_APP_PASSWORD`
- Confirm the visible login screen is present on clean launch

**Maestro errors:**
- Check that Maestro CLI is installed: `maestro --version`
- Or use the bundled version in `maestro/` directory

## Learn More

- [Maestro Documentation](https://maestro.dev)
- [AGENTS.md](./AGENTS.md) - Technical architecture details
