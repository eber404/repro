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
