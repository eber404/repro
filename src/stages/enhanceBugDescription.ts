import { spawnAgent, AgentType } from '@/agents/cli';
import { ReproContext } from '@/context';

const ENHANCER_AGENT = (process.env.REPRO_AGENT || 'claude') as AgentType;
const ENHANCER_TIMEOUT_MS = 45_000;

export async function enhanceBugDescription(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ✍️ Enhancing bug description...');

  if (ctx.enhancedBugDescription) {
    return ctx;
  }

  const prompt = buildEnhancerPrompt(ctx.bug);

  try {
    const result = await spawnAgent(prompt, ENHANCER_AGENT, ENHANCER_TIMEOUT_MS);
    const enhanced = result.trim();
    ctx.enhancedBugDescription = enhanced || ctx.bug;
  } catch (error) {
    ctx.error = `enhanceBugDescription failed: ${(error as Error).message}`;
  }

  return ctx;
}

export function buildEnhancerPrompt(bugDescription: string): string {
  return `You improve mobile bug reports for test automation.

Rules:
- Keep the same language as input.
- Return only one concise improved description.
- Do not include markdown.
- Do not add new facts.

Original bug description:
"${bugDescription}"

Return only the improved description text.`;
}
