import { ReproContext } from '@/context';
import { resolveFlowRunDir } from '@/stages/compiler';

const { mkdirSync, writeFileSync } = require('fs');

const LOGIN_BOOTSTRAP_TIMEOUT_MS = 120_000;

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

type CommandExecutor = (command: string[]) => Promise<CommandResult>;

export async function executeLoginBootstrap(
  ctx: ReproContext,
  executeCommand: CommandExecutor = runCommand
): Promise<ReproContext> {
  console.log('   🔐 Executing login bootstrap...');

  if (!hasCredentials(ctx)) {
    return ctx;
  }

  if (!ctx.loginBootstrapYaml) {
    ctx.error = 'executeLoginBootstrap requires loginBootstrapYaml when credentials are configured';
    return ctx;
  }

  if (!isValidMaestroFlowYaml(ctx.loginBootstrapYaml)) {
    ctx.error = 'executeLoginBootstrap received invalid loginBootstrapYaml';
    return ctx;
  }

  if (!ctx.deviceId) {
    ctx.error = 'executeLoginBootstrap requires deviceId';
    return ctx;
  }

  const flowRunDir = resolveFlowRunDir(ctx.flowDir, ctx.flowFile);
  const attemptDir = `${flowRunDir}/attempt-${ctx.attempt}`;
  mkdirSync(attemptDir, { recursive: true });
  ctx.flowDir = flowRunDir;

  const bootstrapPath = `${attemptDir}/login-bootstrap.yaml`;
  writeFileSync(bootstrapPath, ctx.loginBootstrapYaml);

  const command = [
    ctx.maestroPath,
    '--platform',
    ctx.platform,
    '--udid',
    ctx.deviceId,
    'test',
    bootstrapPath,
    '--no-reinstall-driver'
  ];

  const result = await executeCommand(command);
  if (result.code === 0) {
    return ctx;
  }

  const details = `${result.stderr}\n${result.stdout}`.trim();
  ctx.error = `executeLoginBootstrap failed: ${details || 'unknown error'}`;
  return ctx;
}

export function isValidMaestroFlowYaml(yaml: string): boolean {
  const trimmed = yaml.trim();
  if (!trimmed) {
    return false;
  }

  if (!trimmed.includes('appId:')) {
    return false;
  }

  if (!trimmed.includes('---')) {
    return false;
  }

  return trimmed.includes('- ');
}

async function runCommand(command: string[]): Promise<CommandResult> {
  const proc = Bun.spawn({ cmd: command, stdout: 'pipe', stderr: 'pipe' });

  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    proc.kill();
  }, LOGIN_BOOTSTRAP_TIMEOUT_MS);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  clearTimeout(timer);
  if (didTimeout) {
    return {
      code: 1,
      stdout,
      stderr: `Login bootstrap timed out after ${LOGIN_BOOTSTRAP_TIMEOUT_MS}ms`
    };
  }

  return { code, stdout, stderr };
}

function hasCredentials(ctx: ReproContext): boolean {
  return Boolean(ctx.credentials?.email && ctx.credentials?.password);
}
