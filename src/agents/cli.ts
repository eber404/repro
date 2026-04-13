const DEFAULT_TIMEOUT_MS = 60_000;

export type AgentType = 'claude' | 'codex' | 'opencode' | 'gemini';

export interface AgentResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function buildArgs(agent: AgentType, prompt: string, files?: string[]): string[] {
  const baseArgs: string[] = [];
  
  switch (agent) {
    case 'gemini':
      return ['--prompt', prompt];
    case 'claude':
      baseArgs.push('--print');
      if (files && files.length > 0) {
        for (const file of files) {
          baseArgs.push('--file', file);
        }
      }
      baseArgs.push(prompt);
      return baseArgs;
    case 'codex':
      return ['--prompt', prompt];
    case 'opencode':
      return [prompt];
    default:
      return ['--print', prompt];
  }
}

export async function spawnAgent(
  prompt: string,
  agent: AgentType,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  files?: string[]
): Promise<string> {
  const args = buildArgs(agent, prompt, files);

  const proc = Bun.spawn({
    cmd: [agent, ...args],
    stdout: 'pipe',
    stderr: 'pipe'
  });

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  clearTimeout(timer);
  if (timedOut) {
    throw new Error(`Agent ${agent} timed out after ${timeoutMs}ms`);
  }

  if (code !== 0) {
    throw new Error(`Agent ${agent} exited with code ${code}: ${stderr}`);
  }

  return stdout;
}
