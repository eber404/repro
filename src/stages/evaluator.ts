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
  } catch (err) {
    ctx.error = `Eval agent failed: ${err}`;
    ctx.reproduced = !ctx.executionResult.success;
  }

  return ctx;
}
