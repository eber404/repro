import { ReproContext, Plan } from '@/context';
import { spawnAgent } from '@/agents/cli';

const AGENT_ENV = process.env.REPRO_AGENT || 'claude';
const AGENT_TIMEOUT_MS = 90_000;

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

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

Return only JSON without markdown formatting.`;

  try {
    const result = await spawnAgent(prompt, AGENT_ENV as 'claude' | 'codex' | 'opencode', AGENT_TIMEOUT_MS);
    const jsonText = extractJson(result);
    ctx.plan = JSON.parse(jsonText) as Plan;
  } catch (e) {
    ctx.error = `Planner failed: ${(e as Error).message}`;
  }

  return ctx;
}
