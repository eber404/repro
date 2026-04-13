import { ReproContext, Plan } from '@/context';
import { spawnAgent } from '@/agents/cli';

const AGENT_ENV = process.env.REPRO_AGENT || 'gemini';
const REFINER_TIMEOUT_MS = 90_000;

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

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

Why didn't this plan work? Suggest a refined plan with different steps. Return JSON without markdown formatting.`;

  try {
    const result = await spawnAgent(prompt, AGENT_ENV as 'gemini' | 'claude' | 'codex' | 'opencode', REFINER_TIMEOUT_MS);
    const jsonText = extractJson(result);
    ctx.refinement = JSON.parse(jsonText) as Plan;
    ctx.plan = ctx.refinement;
  } catch (e) {
    ctx.error = `Refiner failed: ${(e as Error).message}`;
  }

  return ctx;
}
