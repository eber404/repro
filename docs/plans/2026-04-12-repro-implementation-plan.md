# repro Implementation Plan

**Date:** 2026-04-12

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous bug reproduction CLI that uses AI agents to explore mobile apps and generate reproducible test flows.

**Architecture:** Pipeline-based where each stage (Context → Plan → Compile → Execute → Observe → Evaluate → Refine) is a discrete function operating on a shared `ReproContext` object. Agents are invoked via `child_process.spawn`.

**Tech Stack:** Bun, TypeScript, @maestro/core SDK, child_process for CLI agent integration

**Development Rules:**
- No nested ifs — flatten control flow, prefer early returns
- No nested ternaries — use readable, simple expressions
- Prefer const — use const by default, let only when mutation is needed
- No magic numbers — extract to named constants
- Clean variable names — name things clearly; avoid abbreviations
- Path aliases — use `@/*` imports (e.g., `@/agents/cli`) over relative paths
- Avoid if-else chains when possible — use map/object lookup or early return patterns
- Bun-first — leverage Bun's built-in APIs; no heavy Node.js polyfills
- Keep AGENTS.md updated — document architectural decisions here as they evolve

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/context.ts`
- Create: `src/config.ts`

**Step 1: Write `package.json`**

```json
{
  "name": "repro",
  "version": "0.1.0",
  "description": "Autonomous Bug Reproduction CLI",
  "type": "module",
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "test": "bun test"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

**Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

**Step 3: Write `src/context.ts`**

```typescript
export interface ReproContext {
  bug: string;
  appPath: string;
  platform: 'android' | 'ios';
  maxRetries: number;
  flowDir: string;
  resetStrategy: 'clear-app-data' | 'deep-link';
  uiTree: object | null;
  plan: Plan | null;
  flowFile: string | null;
  executionResult: ExecutionResult | null;
  executionReport: ExecutionReport | null;
  reproduced: boolean | null;
  refinement: Plan | null;
  error: string | null;
  attempt: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  screenshots: string[];
}

export interface ExecutionReport {
  timestamp: string;
  logs: string;
  screenshots: string[];
  flowFile: string;
}

export interface Plan {
  steps: PlanStep[];
  hypothesis?: string;
}

export interface PlanStep {
  action: 'tap' | 'input' | 'swipe' | 'pressKey' | 'assert';
  element?: string;
  text?: string;
  direction?: string;
  key?: string;
}
```

**Step 4: Write `src/config.ts`**

```typescript
import { existsSync, readFileSync } from 'fs';
import { join, homedir } from 'path';

export interface Config {
  appPath: string;
  platform: 'android' | 'ios';
  maestroSdk: boolean;
  maxRetries: number;
  flowDir: string;
  resetStrategy: 'clear-app-data' | 'deep-link';
}

const DEFAULT_CONFIG: Config = {
  appPath: '',
  platform: 'android',
  maestroSdk: true,
  maxRetries: 5,
  flowDir: './flows',
  resetStrategy: 'clear-app-data'
};

export function loadConfig(cliOverrides?: Partial<Config>): Config {
  const globalConfigPath = join(homedir(), '.repro', 'config.json');
  const localConfigPath = join(process.cwd(), 'repro.config.json');

  let config = { ...DEFAULT_CONFIG };

  if (existsSync(globalConfigPath)) {
    const globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
    config = { ...config, ...globalConfig };
  }

  if (existsSync(localConfigPath)) {
    const localConfig = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
    config = { ...config, ...localConfig };
  }

  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }

  return config;
}
```

**Step 5: Write `src/index.ts`**

```typescript
import { loadConfig } from '@/config';
import { runPipeline } from '@/pipeline';
import { generateReport, printSummary } from '@/utils/output';

const HELP_TEXT = `
repro - Autonomous Bug Reproduction CLI

Usage:
  repro "bug description"          Use config defaults
  repro "bug" --app ./app.apk     Override app path
  repro --help                    Show this help
  repro --version                 Show version

Configuration:
  Set defaults in ~/.repro/config.json or ./repro.config.json
`;

const VERSION = 'repro v0.1.0';

function parseArgs(args: string[]): { bug: string; overrides: Partial<Config> } {
  const overrides: Partial<Config> = {};
  const bug = args.find(arg => !arg.startsWith('--'));

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--app') overrides.appPath = args[++i];
    else if (arg === '--retries') overrides.maxRetries = parseInt(args[++i], 10);
    else if (arg === '--platform') overrides.platform = args[++i] as 'android' | 'ios';
  }

  return { bug: bug || '', overrides };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    return;
  }

  const { bug, overrides } = parseArgs(args);

  if (!bug) {
    console.error('Error: Bug description required');
    console.error('Usage: repro "app crashes on login"');
    process.exit(1);
  }

  const config = loadConfig(overrides);

  console.log(`🔍 repro: "${bug}"`);
  console.log(`   app: ${config.appPath}`);
  console.log(`   platform: ${config.platform}`);
  console.log(`   max retries: ${config.maxRetries}`);

  const ctx = await runPipeline({
    bug,
    appPath: config.appPath,
    platform: config.platform,
    maxRetries: config.maxRetries,
    flowDir: config.flowDir,
    resetStrategy: config.resetStrategy,
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  });

  if (ctx.reproduced) {
    generateReport(ctx);
  }

  printSummary(ctx);
}

main();
```

**Step 6: Run to verify**

Run: `bun run src/index.ts --help`
Expected: Help text displayed

**Step 7: Commit**

```bash
git add package.json tsconfig.json src/index.ts src/context.ts src/config.ts
git commit -m "feat: scaffold project structure"
```

---

## Task 2: CLI Agent Integration

**Files:**
- Create: `src/agents/cli.ts`
- Create: `tests/agents/cli.test.ts`

**Step 1: Write `src/agents/cli.ts`**

```typescript
import { spawn } from 'child_process';

const DEFAULT_TIMEOUT_MS = 60_000;

export interface AgentResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function spawnAgent(
  prompt: string,
  agent: 'claude' | 'codex' | 'opencode',
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(agent, ['--print', prompt], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error(`Agent ${agent} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        reject(new Error(`Agent ${agent} exited with code ${code}: ${stderr}`));
        return;
      }

      resolve(stdout);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
```

**Step 2: Write `tests/agents/cli.test.ts`**

```typescript
import { expect, test } from 'bun:test';
import { spawnAgent } from '@/agents/cli';

test('spawnAgent returns output from echo', async () => {
  const result = await spawnAgent('hello world', 'claude');
  expect(result).toContain('hello');
});
```

**Step 3: Run test to verify it fails**

Run: `bun test`
Expected: FAIL with "spawnAgent not defined"

**Step 4: Write minimal implementation**

(Same as Step 1 above)

**Step 5: Run test to verify it passes**

Run: `bun test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/agents/cli.ts tests/agents/cli.test.ts
git commit -m "feat: add CLI agent integration"
```

---

## Task 3: Pipeline Orchestrator

**Files:**
- Create: `src/pipeline.ts`

**Step 1: Write `src/pipeline.ts`**

```typescript
import { ReproContext } from '@/context';
import { gatherContext } from '@/stages/gatherContext';
import { plan } from '@/stages/planner';
import { compile } from '@/stages/compiler';
import { resetState } from '@/stages/stateManager';
import { execute } from '@/stages/executor';
import { observe } from '@/stages/observer';
import { evaluate } from '@/stages/evaluator';
import { refine } from '@/stages/refiner';

const PIPELINE_STAGES = [
  gatherContext,
  plan,
  compile,
  resetState,
  execute,
  observe,
  evaluate,
  refine
] as const;

export async function runPipeline(ctx: ReproContext): Promise<ReproContext> {
  let currentCtx = { ...ctx };

  for (let attempt = 1; attempt <= ctx.maxRetries; attempt++) {
    console.log(`\n📍 Attempt ${attempt}/${ctx.maxRetries}`);

    for (const stage of PIPELINE_STAGES) {
      const stageStart = Date.now();

      try {
        currentCtx = await stage(currentCtx);
      } catch (e) {
        currentCtx.error = `${stage.name}: ${(e as Error).message}`;
      }

      if (currentCtx.error) {
        console.log(`   ❌ ${stage.name}: ${currentCtx.error}`);
        break;
      }

      console.log(`   ✅ ${stage.name} (${Date.now() - stageStart}ms)`);
    }

    if (currentCtx.reproduced === true) {
      console.log('\n✅ Bug reproduced successfully!');
      return currentCtx;
    }

    if (attempt < ctx.maxRetries && currentCtx.refinement) {
      console.log('\n🔄 Refining strategy...');
      currentCtx.attempt = attempt + 1;
      continue;
    }

    if (attempt === ctx.maxRetries) {
      console.log(`\n❌ Failed to reproduce after ${attempt} attempts`);
    }
  }

  return currentCtx;
}
```

**Step 2: Commit**

```bash
git add src/pipeline.ts
git commit -m "feat: add pipeline orchestrator"
```

---

## Task 4: Stage Implementations

**Files:**
- Create: `src/stages/gatherContext.ts`
- Create: `src/stages/planner.ts`
- Create: `src/stages/compiler.ts`
- Create: `src/stages/stateManager.ts`
- Create: `src/stages/executor.ts`
- Create: `src/stages/observer.ts`
- Create: `src/stages/evaluator.ts`
- Create: `src/stages/refiner.ts`

**Step 1: Write `src/stages/gatherContext.ts`**

```typescript
import { ReproContext } from '@/context';

export async function gatherContext(ctx: ReproContext): Promise<ReproContext> {
  console.log('   👁️ Gathering UI context...');

  // TODO: Integrate @maestro/core SDK for actual UI tree extraction
  // Placeholder implementation
  ctx.uiTree = {
    screen: 'LoginScreen',
    elements: [
      { id: 'email_input', type: 'TextField', label: 'Email' },
      { id: 'password_input', type: 'TextField', label: 'Password' },
      { id: 'login_button', type: 'Button', label: 'Login' }
    ]
  };

  return ctx;
}
```

**Step 2: Write `src/stages/planner.ts`**

```typescript
import { ReproContext, Plan } from '@/context';
import { spawnAgent } from '@/agents/cli';

const AGENT_ENV = process.env.REPRO_AGENT || 'claude';
const AGENT_TIMEOUT_MS = 90_000;

export async function plan(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🧠 Planning...');

  if (!ctx.uiTree) {
    ctx.error = 'Planner requires uiTree from gatherContext';
    return ctx;
  }

  const prompt = `Bug: "${ctx.bug}"
UI Tree: ${JSON.stringify(ctx.uiTree, null, 2)}

Generate a JSON plan to reproduce this bug. Include:
- steps: array of actions (tap, input, swipe, etc.)
- expectedResult: what should happen when bug is triggered

Return only JSON.`;

  try {
    const result = await spawnAgent(prompt, AGENT_ENV as 'claude' | 'codex' | 'opencode', AGENT_TIMEOUT_MS);
    ctx.plan = JSON.parse(result) as Plan;
  } catch (e) {
    ctx.error = `Planner failed: ${(e as Error).message}`;
  }

  return ctx;
}
```

**Step 3: Write `src/stages/compiler.ts`**

```typescript
import { ReproContext } from '@/context';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;

export async function compile(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🛠️ Compiling to YAML...');

  if (!ctx.plan?.steps) {
    ctx.error = 'Compiler requires plan with steps';
    return ctx;
  }

  const flowDir = ctx.flowDir;
  if (!existsSync(flowDir)) {
    mkdirSync(flowDir, { recursive: true });
  }

  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const flowFile = join(flowDir, `${hash}.yaml`);

  let yaml = `# repro-generated: ${ctx.bug}\n`;
  yaml += `# Platform: ${ctx.platform}\n\n`;
  yaml += `appId: ${ctx.appPath}\n\n`;

  for (const step of ctx.plan.steps) {
    yaml += compileStepToYaml(step) + '\n';
  }

  writeFileSync(flowFile, yaml);
  ctx.flowFile = flowFile;

  return ctx;
}

function compileStepToYaml(step: { action: string; element?: string; text?: string; direction?: string }): string {
  switch (step.action) {
    case 'tap':
      return `- tapOn: "${step.element}"\n`;
    case 'input':
      return `- inputText: "${step.text}"\n`;
    case 'swipe':
      return `- swipe: "${step.direction}"\n`;
    case 'pressKey':
      return `- pressKey: "${step.element}"\n`;
    case 'assert':
      return `- assertVisible: "${step.element}"\n`;
    default:
      return `# Unknown action: ${step.action}`;
  }
}
```

**Step 4: Write `src/stages/stateManager.ts`**

```typescript
import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const ADB_CLEAR_TIMEOUT_MS = 30_000;

export async function resetState(ctx: ReproContext): Promise<ReproContext> {
  console.log(`   🧹 Resetting state (${ctx.resetStrategy})...`);

  if (ctx.resetStrategy !== 'clear-app-data') {
    return ctx;
  }

  const packageName = extractPackageName(ctx.appPath);

  return new Promise((resolve) => {
    const cmd = ctx.platform === 'android'
      ? `adb shell pm clear ${packageName}`
      : `xcrun simctl erase ${packageName}`;

    const proc = spawn(cmd, [], { shell: true, timeout: ADB_CLEAR_TIMEOUT_MS });

    proc.on('close', () => resolve(ctx));
    proc.on('error', () => {
      ctx.error = `Failed to reset state: ${cmd}`;
      resolve(ctx);
    });
  });
}

function extractPackageName(appPath: string): string {
  const match = appPath.match(/([^\/]+)\.(apk|ipa)$/);
  return match?.[1] || 'unknown';
}
```

**Step 5: Write `src/stages/executor.ts`**

```typescript
import { ReproContext } from '@/context';
import { spawn } from 'child_process';

const EXECUTOR_TIMEOUT_MS = 300_000;

export async function execute(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ⚡ Executing flow...');

  if (!ctx.flowFile) {
    ctx.error = 'Executor requires flowFile from compiler';
    return ctx;
  }

  return new Promise((resolve) => {
    const cmd = `maestro test ${ctx.flowFile}`;
    const proc = spawn(cmd, [], { shell: true, timeout: EXECUTOR_TIMEOUT_MS });

    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.stderr?.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      ctx.executionResult = {
        success: code === 0,
        output,
        screenshots: []
      };
      resolve(ctx);
    });

    proc.on('error', (err) => {
      ctx.error = `Executor failed: ${err.message}`;
      resolve(ctx);
    });
  });
}
```

**Step 6: Write `src/stages/observer.ts`**

```typescript
import { ReproContext } from '@/context';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;
const LOG_CAPTURE_TIMEOUT_MS = 30_000;

export async function observe(ctx: ReproContext): Promise<ReproContext> {
  console.log('   📡 Observing execution...');

  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const reportDir = join(ctx.flowDir, hash);
  const logsDir = join(reportDir, 'logs');

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  const logs = await captureDeviceLogs(ctx.platform);
  const logFile = join(logsDir, 'device.log');
  writeFileSync(logFile, logs);

  ctx.executionReport = {
    timestamp: new Date().toISOString(),
    logs: logFile,
    screenshots: ctx.executionResult?.screenshots || [],
    flowFile: ctx.flowFile || ''
  };

  return ctx;
}

async function captureDeviceLogs(platform: 'android' | 'ios'): Promise<string> {
  const cmd = platform === 'android'
    ? 'adb logcat -d'
    : 'xcrun simctl diagnose';

  return new Promise((resolve) => {
    const proc = spawn(cmd, [], { shell: true, timeout: LOG_CAPTURE_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve('Failed to capture logs'));
  });
}
```

**Step 7: Write `src/stages/evaluator.ts`**

```typescript
import { ReproContext } from '@/context';
import { spawnAgent } from '@/agents/cli';

const EVAL_AGENT = process.env.REPRO_EVAL_AGENT || process.env.REPRO_AGENT || 'claude';
const EVAL_TIMEOUT_MS = 60_000;

export async function evaluate(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ⚖️ Evaluating...');

  if (!ctx.executionResult || !ctx.executionReport) {
    ctx.error = 'Evaluator requires executionResult and executionReport';
    return ctx;
  }

  const prompt = `Bug description: "${ctx.bug}"
Execution result: ${ctx.executionResult.success ? 'SUCCESS' : 'FAILURE'}
Execution output: ${ctx.executionResult.output}
Device logs: ${ctx.executionReport.logs}

Did the bug get reproduced? Answer with JSON: {"reproduced": true/false, "reason": "..."}`;

  try {
    const result = await spawnAgent(prompt, EVAL_AGENT as 'claude' | 'codex' | 'opencode', EVAL_TIMEOUT_MS);
    const parsed = JSON.parse(result);
    ctx.reproduced = parsed.reproduced;
  } catch {
    ctx.reproduced = !ctx.executionResult.success;
  }

  return ctx;
}
```

**Step 8: Write `src/stages/refiner.ts`**

```typescript
import { ReproContext, Plan } from '@/context';
import { spawnAgent } from '@/agents/cli';

const AGENT_ENV = process.env.REPRO_AGENT || 'claude';
const REFINER_TIMEOUT_MS = 90_000;

export async function refine(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🔄 Refining...');

  if (ctx.reproduced) {
    ctx.refinement = null;
    return ctx;
  }

  const prompt = `Bug: "${ctx.bug}"
Previous plan: ${JSON.stringify(ctx.plan)}
Execution result: FAILURE
Execution output: ${ctx.executionResult?.output}

Why didn't this plan work? Suggest a refined plan with different steps. Return JSON with "steps" array.`;

  try {
    const result = await spawnAgent(prompt, AGENT_ENV as 'claude' | 'codex' | 'opencode', REFINER_TIMEOUT_MS);
    ctx.refinement = JSON.parse(result) as Plan;
    ctx.plan = ctx.refinement;
  } catch (e) {
    ctx.error = `Refiner failed: ${(e as Error).message}`;
  }

  return ctx;
}
```

**Step 9: Commit**

```bash
git add src/stages/
git commit -m "feat: implement all pipeline stages"
```

---

## Task 5: Output & Reporting

**Files:**
- Create: `src/utils/output.ts`
- Create: `src/utils/index.ts` (re-export)

**Step 1: Write `src/utils/output.ts`**

```typescript
import { ReproContext } from '@/context';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;

export function generateReport(ctx: ReproContext): void {
  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const reportDir = join(ctx.flowDir, hash);

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reproAttempts = ctx.reproduced ? 1 : 0;
  const totalAttempts = ctx.attempt;

  const report = {
    bugDescription: ctx.bug,
    reproRate: `${reproAttempts}/${totalAttempts}`,
    flowFile: ctx.flowFile,
    hypothesis: ctx.plan?.hypothesis || 'Unknown',
    attempts: ctx.attempt,
    screenshotsDir: join(reportDir, 'screenshots'),
    logsDir: join(reportDir, 'logs')
  };

  const reportFile = join(reportDir, 'report.json');
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📄 Report saved to: ${reportFile}`);
}

export function printSummary(ctx: ReproContext): void {
  console.log('\n========== REPRO SUMMARY ==========');
  console.log(`Bug: ${ctx.bug}`);
  console.log(`Reproduced: ${ctx.reproduced ? '✅ YES' : '❌ NO'}`);
  console.log(`Flow file: ${ctx.flowFile}`);
  console.log(`Attempts: ${ctx.attempt}`);
  console.log('===================================');
}
```

**Step 2: Write `src/utils/index.ts`**

```typescript
export { generateReport, printSummary } from './output';
```

**Step 3: Commit**

```bash
git add src/utils/output.ts src/utils/index.ts
git commit -m "feat: add report generation and summary output"
```

---

## Task 6: Platform Detection (Android/iOS)

**Files:**
- Create: `src/platform/android.ts`
- Create: `src/platform/ios.ts`
- Create: `src/platform/index.ts`

**Step 1: Write `src/platform/android.ts`**

```typescript
import { spawn } from 'child_process';

const ADB_TIMEOUT_MS = 30_000;

export async function getAndroidDevices(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('adb', ['devices'], { timeout: ADB_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const devices = output
        .split('\n')
        .slice(1)
        .map(line => line.split('\t')[0])
        .filter(Boolean);
      resolve(devices);
    });
    proc.on('error', () => resolve([]));
  });
}

export async function clearAndroidAppData(packageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('adb', ['shell', 'pm', 'clear', packageName], { timeout: ADB_TIMEOUT_MS });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to clear data: exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function captureAndroidLogs(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('adb', ['logcat', '-d'], { timeout: ADB_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}
```

**Step 2: Write `src/platform/ios.ts`**

```typescript
import { spawn } from 'child_process';

const SIMCTL_TIMEOUT_MS = 30_000;

export async function getIOSSimulators(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'list', 'devices', 'available'], { timeout: SIMCTL_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => {
      const simulators = output
        .split('\n')
        .filter(line => line.includes('iPhone') || line.includes('iPad'))
        .map(line => line.split('(')[0].trim());
      resolve(simulators);
    });
    proc.on('error', () => resolve([]));
  });
}

export async function resetIOSSimulator(deviceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('xcrun', ['simctl', 'erase', deviceId], { timeout: SIMCTL_TIMEOUT_MS });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to erase simulator: exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function captureIOSLogs(_deviceId: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'diagnose'], { timeout: SIMCTL_TIMEOUT_MS });
    let output = '';

    proc.stdout?.on('data', (data) => { output += data.toString(); });
    proc.on('close', () => resolve(output));
    proc.on('error', () => resolve(''));
  });
}
```

**Step 3: Write `src/platform/index.ts`**

```typescript
export { getAndroidDevices, clearAndroidAppData, captureAndroidLogs } from './android';
export { getIOSSimulators, resetIOSSimulator, captureIOSLogs } from './ios';
```

**Step 4: Commit**

```bash
git add src/platform/
git commit -m "feat: add platform-specific handlers"
```

---

## Task 7: End-to-End Integration Test

**Files:**
- Create: `tests/e2e.test.ts`

**Step 1: Write `tests/e2e.test.ts`**

```typescript
import { expect, test } from 'bun:test';
import { runPipeline } from '@/pipeline';

test('pipeline runs without crashing', async () => {
  const ctx = {
    bug: 'test bug',
    appPath: '/fake/path.app',
    platform: 'android' as const,
    maxRetries: 1,
    flowDir: './test-flows',
    resetStrategy: 'clear-app-data' as const,
    uiTree: null,
    plan: null,
    flowFile: null,
    executionResult: null,
    executionReport: null,
    reproduced: null,
    refinement: null,
    error: null,
    attempt: 1
  };

  const result = await runPipeline(ctx);
  expect(result).toBeDefined();
  expect(result.attempt).toBe(1);
});
```

**Step 2: Run test to verify it passes**

Run: `bun test`
Expected: PASS (or skip if stages not fully implemented)

**Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add e2e integration test"
```

---

## File Structure

```
repro/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── config.ts          # Config loading
│   ├── context.ts         # ReproContext type
│   ├── pipeline.ts        # Main pipeline orchestrator
│   ├── agents/
│   │   └── cli.ts         # Agent invocation via spawn
│   ├── stages/
│   │   ├── gatherContext.ts
│   │   ├── planner.ts
│   │   ├── compiler.ts
│   │   ├── stateManager.ts
│   │   ├── executor.ts
│   │   ├── observer.ts
│   │   ├── evaluator.ts
│   │   └── refiner.ts
│   ├── platform/
│   │   ├── android.ts
│   │   ├── ios.ts
│   │   └── index.ts
│   └── utils/
│       ├── output.ts
│       └── index.ts
├── flows/                  # Generated YAML flows
├── docs/
│   └── plans/             # Design documents
├── tests/
│   ├── agents/
│   │   └── cli.test.ts
│   └── e2e.test.ts
├── repro.config.json      # Project config (optional)
├── package.json
└── tsconfig.json
```