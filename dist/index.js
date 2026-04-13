// @bun
// src/config.ts
import { join } from "path";
import { homedir } from "os";
var DEFAULT_CONFIG = {
  appPath: "",
  platform: "android",
  maestroSdk: true,
  maxRetries: 5,
  flowDir: "./flows",
  resetStrategy: "clear-app-data"
};
function loadConfig(cliOverrides) {
  const globalConfigPath = Bun.file(join(homedir(), ".repro", "config.json"));
  const localConfigPath = Bun.file(join(process.cwd(), "repro.config.json"));
  let config = { ...DEFAULT_CONFIG };
  if (globalConfigPath.exists) {
    const globalConfig = JSON.parse(globalConfigPath.text());
    config = { ...config, ...globalConfig };
  }
  if (localConfigPath.exists) {
    const localConfig = JSON.parse(localConfigPath.text());
    config = { ...config, ...localConfig };
  }
  if (cliOverrides) {
    config = { ...config, ...cliOverrides };
  }
  return config;
}

// src/stages/gatherContext.ts
async function gatherContext(ctx) {
  console.log("   \uD83D\uDC41\uFE0F Gathering UI context...");
  ctx.uiTree = {
    screen: "LoginScreen",
    elements: [
      { id: "email_input", type: "TextField", label: "Email" },
      { id: "password_input", type: "TextField", label: "Password" },
      { id: "login_button", type: "Button", label: "Login" }
    ]
  };
  return ctx;
}

// src/agents/cli.ts
import { spawn } from "child_process";
var DEFAULT_TIMEOUT_MS = 60000;
async function spawnAgent(prompt, agent, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const proc = spawn(agent, ["--print", prompt], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error(`Agent ${agent} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut)
        return;
      if (code !== 0) {
        reject(new Error(`Agent ${agent} exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// src/stages/planner.ts
var AGENT_ENV = process.env.REPRO_AGENT || "claude";
var AGENT_TIMEOUT_MS = 90000;
async function plan(ctx) {
  console.log("   \uD83E\uDDE0 Planning...");
  if (!ctx.uiTree) {
    ctx.error = "Planner requires uiTree from gatherContext";
    return ctx;
  }
  const prompt = `Bug: "${ctx.bug}"
UI Tree: ${JSON.stringify(ctx.uiTree, null, 2)}

Generate a JSON plan to reproduce this bug. Include:
- steps: array of actions (tap, input, swipe, etc.)
- expectedResult: what should happen when bug is triggered

Return only JSON.`;
  try {
    const result = await spawnAgent(prompt, AGENT_ENV, AGENT_TIMEOUT_MS);
    ctx.plan = JSON.parse(result);
  } catch (e) {
    ctx.error = `Planner failed: ${e.message}`;
  }
  return ctx;
}

// src/stages/compiler.ts
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join as join2 } from "path";
var HASH_LENGTH = 8;
async function compile(ctx) {
  console.log("   \uD83D\uDEE0\uFE0F Compiling to YAML...");
  if (!ctx.plan?.steps) {
    ctx.error = "Compiler requires plan with steps";
    return ctx;
  }
  const flowDir = ctx.flowDir;
  if (!existsSync(flowDir)) {
    mkdirSync(flowDir, { recursive: true });
  }
  const hash = ctx.bug.replace(/[^a-z0-9]/gi, "").substring(0, HASH_LENGTH);
  const flowFile = join2(flowDir, `${hash}.yaml`);
  let yaml = `# repro-generated: ${ctx.bug}
`;
  yaml += `# Platform: ${ctx.platform}

`;
  yaml += `appId: ${ctx.appPath}

`;
  for (const step of ctx.plan.steps) {
    yaml += compileStepToYaml(step) + `
`;
  }
  writeFileSync(flowFile, yaml);
  ctx.flowFile = flowFile;
  return ctx;
}
function compileStepToYaml(step) {
  switch (step.action) {
    case "tap":
      return `- tapOn: "${step.element}"
`;
    case "input":
      return `- inputText: "${step.text}"
`;
    case "swipe":
      return `- swipe: "${step.direction}"
`;
    case "pressKey":
      return `- pressKey: "${step.element}"
`;
    case "assert":
      return `- assertVisible: "${step.element}"
`;
    default:
      return `# Unknown action: ${step.action}`;
  }
}

// src/stages/stateManager.ts
import { spawn as spawn2 } from "child_process";
var ADB_CLEAR_TIMEOUT_MS = 30000;
async function resetState(ctx) {
  console.log(`   \uD83E\uDDF9 Resetting state (${ctx.resetStrategy})...`);
  if (ctx.resetStrategy !== "clear-app-data") {
    return ctx;
  }
  const packageName = extractPackageName(ctx.appPath);
  return new Promise((resolve) => {
    const cmd = ctx.platform === "android" ? `adb shell pm clear ${packageName}` : `xcrun simctl erase ${packageName}`;
    const proc = spawn2(cmd, [], { shell: true, timeout: ADB_CLEAR_TIMEOUT_MS });
    proc.on("close", () => resolve(ctx));
    proc.on("error", () => {
      ctx.error = `Failed to reset state: ${cmd}`;
      resolve(ctx);
    });
  });
}
function extractPackageName(appPath) {
  const match = appPath.match(/([^\/]+)\.(apk|ipa)$/);
  return match?.[1] || "unknown";
}

// src/stages/executor.ts
import { spawn as spawn3 } from "child_process";
var EXECUTOR_TIMEOUT_MS = 300000;
async function execute(ctx) {
  console.log("   \u26A1 Executing flow...");
  if (!ctx.flowFile) {
    ctx.error = "Executor requires flowFile from compiler";
    return ctx;
  }
  return new Promise((resolve) => {
    const cmd = `maestro test ${ctx.flowFile}`;
    const proc = spawn3(cmd, [], { shell: true, timeout: EXECUTOR_TIMEOUT_MS });
    let output = "";
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });
    proc.on("close", (code) => {
      ctx.executionResult = {
        success: code === 0,
        output,
        screenshots: []
      };
      resolve(ctx);
    });
    proc.on("error", (err) => {
      ctx.error = `Executor failed: ${err.message}`;
      resolve(ctx);
    });
  });
}

// src/stages/observer.ts
import { spawn as spawn4 } from "child_process";
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2, existsSync as existsSync2 } from "fs";
import { join as join3 } from "path";
var HASH_LENGTH2 = 8;
var LOG_CAPTURE_TIMEOUT_MS = 30000;
async function observe(ctx) {
  console.log("   \uD83D\uDCE1 Observing execution...");
  const hash = ctx.bug.replace(/[^a-z0-9]/gi, "").substring(0, HASH_LENGTH2);
  const reportDir = join3(ctx.flowDir, hash);
  const logsDir = join3(reportDir, "logs");
  if (!existsSync2(logsDir)) {
    mkdirSync2(logsDir, { recursive: true });
  }
  const logs = await captureDeviceLogs(ctx.platform);
  const logFile = join3(logsDir, "device.log");
  writeFileSync2(logFile, logs);
  ctx.executionReport = {
    timestamp: new Date().toISOString(),
    logs: logFile,
    screenshots: ctx.executionResult?.screenshots || [],
    flowFile: ctx.flowFile || ""
  };
  return ctx;
}
async function captureDeviceLogs(platform) {
  const cmd = platform === "android" ? "adb logcat -d" : "xcrun simctl diagnose";
  return new Promise((resolve) => {
    const proc = spawn4(cmd, [], { shell: true, timeout: LOG_CAPTURE_TIMEOUT_MS });
    let output = "";
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    proc.on("close", () => resolve(output));
    proc.on("error", () => resolve("Failed to capture logs"));
  });
}

// src/stages/evaluator.ts
var EVAL_AGENT = process.env.REPRO_EVAL_AGENT || process.env.REPRO_AGENT || "claude";
var EVAL_TIMEOUT_MS = 60000;
async function evaluate(ctx) {
  console.log("   \u2696\uFE0F Evaluating...");
  if (!ctx.executionResult || !ctx.executionReport) {
    ctx.error = "Evaluator requires executionResult and executionReport";
    return ctx;
  }
  const prompt = `Bug description: "${ctx.bug}"
Execution result: ${ctx.executionResult.success ? "SUCCESS" : "FAILURE"}
Execution output: ${ctx.executionResult.output}
Device logs: ${ctx.executionReport.logs}

Did the bug get reproduced? Answer with JSON: {"reproduced": true/false, "reason": "..."}`;
  try {
    const result = await spawnAgent(prompt, EVAL_AGENT, EVAL_TIMEOUT_MS);
    const parsed = JSON.parse(result);
    ctx.reproduced = parsed.reproduced;
  } catch {
    ctx.reproduced = !ctx.executionResult.success;
  }
  return ctx;
}

// src/stages/refiner.ts
var AGENT_ENV2 = process.env.REPRO_AGENT || "claude";
var REFINER_TIMEOUT_MS = 90000;
async function refine(ctx) {
  console.log("   \uD83D\uDD04 Refining...");
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
    const result = await spawnAgent(prompt, AGENT_ENV2, REFINER_TIMEOUT_MS);
    ctx.refinement = JSON.parse(result);
    ctx.plan = ctx.refinement;
  } catch (e) {
    ctx.error = `Refiner failed: ${e.message}`;
  }
  return ctx;
}

// src/pipeline.ts
var PIPELINE_STAGES = [
  gatherContext,
  plan,
  compile,
  resetState,
  execute,
  observe,
  evaluate,
  refine
];
async function runPipeline(ctx) {
  let currentCtx = { ...ctx };
  for (let attempt = 1;attempt <= ctx.maxRetries; attempt++) {
    console.log(`
\uD83D\uDCCD Attempt ${attempt}/${ctx.maxRetries}`);
    for (const stage of PIPELINE_STAGES) {
      const stageStart = Date.now();
      try {
        currentCtx = await stage(currentCtx);
      } catch (e) {
        currentCtx.error = `${stage.name}: ${e.message}`;
      }
      if (currentCtx.error) {
        console.log(`   \u274C ${stage.name}: ${currentCtx.error}`);
        break;
      }
      console.log(`   \u2705 ${stage.name} (${Date.now() - stageStart}ms)`);
    }
    if (currentCtx.reproduced === true) {
      console.log(`
\u2705 Bug reproduced successfully!`);
      return currentCtx;
    }
    if (attempt < ctx.maxRetries && currentCtx.refinement) {
      console.log(`
\uD83D\uDD04 Refining strategy...`);
      currentCtx.attempt = attempt + 1;
      continue;
    }
    if (attempt === ctx.maxRetries) {
      console.log(`
\u274C Failed to reproduce after ${attempt} attempts`);
    }
  }
  return currentCtx;
}

// src/utils/output.ts
function generateReport(_ctx) {}
function printSummary(_ctx) {}

// src/index.ts
var RADIX = 10;
var HELP_TEXT = `
repro - Autonomous Bug Reproduction CLI

Usage:
  repro "bug description"          Use config defaults
  repro "bug" --app ./app.apk     Override app path
  repro --help                    Show this help
  repro --version                 Show version

Configuration:
  Set defaults in ~/.repro/config.json or ./repro.config.json
`;
var VERSION = "repro v0.1.0";
function parseArgs(args) {
  const overrides = {};
  const bug = args.find((arg) => !arg.startsWith("--"));
  for (let i = 0;i < args.length; i++) {
    const arg = args[i];
    if (arg === "--app")
      overrides.appPath = args[++i];
    else if (arg === "--retries")
      overrides.maxRetries = parseInt(args[++i], RADIX);
    else if (arg === "--platform")
      overrides.platform = args[++i];
  }
  return { bug: bug || "", overrides };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return;
  }
  const { bug, overrides } = parseArgs(args);
  if (!bug) {
    console.error("Error: Bug description required");
    console.error('Usage: repro "app crashes on login"');
    process.exit(1);
  }
  const config = loadConfig(overrides);
  console.log(`\uD83D\uDD0D repro: "${bug}"`);
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
