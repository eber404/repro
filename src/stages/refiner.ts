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
