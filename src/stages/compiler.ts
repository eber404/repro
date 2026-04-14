import { ReproContext } from '@/context';

const { mkdirSync, existsSync, writeFileSync } = require('fs');
const { dirname } = require('path');

const TIMESTAMP_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}_${h}-${mi}-${s}`;
}

export async function compile(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🛠️ Compiling to YAML...');

  if (!ctx.plan?.steps) {
    ctx.error = 'Compiler requires plan with steps';
    return ctx;
  }

  if (!ctx.flowDir || ctx.flowDir === '') {
    ctx.error = 'flowDir is required';
    return ctx;
  }

  const flowRunDir = resolveFlowRunDir(ctx.flowDir, ctx.flowFile);
  const attemptDir = `${flowRunDir}/attempt-${ctx.attempt}`;

  ctx.flowDir = flowRunDir;

  mkdirSync(attemptDir, { recursive: true });

  const yaml = generateMaestroYaml(ctx);
  const flowFile = `${attemptDir}/flow.yaml`;
  writeFileSync(flowFile, yaml);
  ctx.flowFile = flowFile;

  return ctx;
}

export function resolveFlowRunDir(flowDir: string, flowFile: string | null): string {
  if (flowFile) {
    return dirname(dirname(flowFile));
  }

  if (isTimestampDirectory(flowDir)) {
    return flowDir;
  }

  const timestamp = formatTimestamp(new Date());
  return `${flowDir}/${timestamp}`;
}

function isTimestampDirectory(pathValue: string): boolean {
  const segments = pathValue.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    return false;
  }

  return TIMESTAMP_DIRECTORY_PATTERN.test(lastSegment);
}

function generateMaestroYaml(ctx: ReproContext): string {
  let yaml = `# repro-generated: ${ctx.bug}\n`;
  yaml += `# Platform: ${ctx.platform}\n`;
  yaml += `# App: ${ctx.appId}\n`;
  yaml += `# Device: ${ctx.deviceId}\n\n`;
  yaml += `appId: ${ctx.appId}\n`;
  yaml += `platform: ${ctx.platform}\n`;
  yaml += `---\n`;

  yaml += `- launchApp:\n`;
  yaml += `    appId: ${ctx.appId}\n`;
  yaml += `    clearState: true\n`;
  yaml += `    clearKeychain: true\n`;

  if (ctx.plan) {
    for (const step of ctx.plan.steps) {
      yaml += `${compileStepToYaml(step)}`;
    }
  }

  return yaml;
}

export function normalizeSelector(selector: string): string {
  const firstAlternative = selector.split('|')[0] ?? '';
  return firstAlternative.trim();
}

function compileStepToYaml(step: { action: string; element?: string; text?: string; direction?: string; key?: string; target?: string; value?: string }): string {
  const safeElement = step.element && step.element !== 'undefined' ? step.element : null;
  const safeText = step.text && step.text !== 'undefined' ? step.text : null;
  const safeDirection = step.direction && step.direction !== 'undefined' ? step.direction : null;
  const safeKey = step.key && step.key !== 'undefined' ? step.key : null;

  switch (step.action) {
    case 'tap':
      if (!safeElement) return '';
      return `- tapOn: "${normalizeSelector(safeElement)}"\n`;
    case 'input':
      if (!safeText) return '';
      return `- inputText:\n    text: "${safeText}"\n`;
    case 'swipe':
      if (!safeDirection) return '';
      return `- swipe: "${safeDirection.toUpperCase()}"\n`;
    case 'pressKey':
      if (!safeKey) return '';
      return `- pressKey: "${safeKey}"\n`;
    case 'assert':
      if (!safeElement) return '';
      return `- assertVisible: "${normalizeSelector(safeElement)}"\n`;
    default:
      return `# Unsupported action: ${step.action}\n`;
  }
}
