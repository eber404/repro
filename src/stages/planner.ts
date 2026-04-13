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
