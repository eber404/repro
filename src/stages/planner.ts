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

  const prompt = buildPlannerPrompt(ctx);

  try {
    const result = await spawnAgent(prompt, AGENT_ENV as 'gemini' | 'claude' | 'codex' | 'opencode', AGENT_TIMEOUT_MS);
    const jsonText = extractJson(result);
    ctx.plan = JSON.parse(jsonText) as Plan;
  } catch (e) {
    ctx.error = `Planner failed: ${(e as Error).message}`;
  }

  return ctx;
}

export function buildPlannerPrompt(ctx: ReproContext): string {
  const bugDescription = ctx.enhancedBugDescription || ctx.bug;
  const credentialsInfo = ctx.credentials?.email && ctx.credentials?.password
    ? `\n\nAPP CREDENTIALS (use these for login):
- email: "${ctx.credentials.email}"
- password: "${ctx.credentials.password}"`
    : '';

  const screenAnalysis = ctx.screenAnalysis
    ? `\n\nSCREEN ANALYSIS: ${typeof ctx.screenAnalysis === 'string' ? ctx.screenAnalysis : JSON.stringify(ctx.screenAnalysis)}`
    : '';

  const refinementInfo = ctx.refinement
    ? `\n\nPREVIOUS FAILED ATTEMPT CONTEXT:
- previousPlan: ${JSON.stringify(ctx.refinement)}
- latestExecutionSummary: ${ctx.executionResult?.output || 'none'}
- latestEvaluation: ${ctx.reproduced === false ? 'not reproduced' : 'unknown'}`
    : '';

  return `Bug: "${bugDescription}"${credentialsInfo}${screenAnalysis}${refinementInfo}
UI Tree: ${JSON.stringify(ctx.uiTree, null, 2)}

Generate a JSON plan to reproduce this bug.

CRITICAL: Only use these Maestro-supported actions:
- tap: use "element" for selector
- input: use "text" for the text to type
- swipe: use "direction" (UP|DOWN|LEFT|RIGHT - UPPERCASE only)
- pressKey: use "key" for key name (back, home, enter, etc.)
- assert: use "element" for what should be visible
- launchApp: included automatically, do NOT add as step

INVALID actions (do NOT use): waitForElement, navigate, assertScreenTransitionCount, scroll, etc.

Selector rules:
- Use exact labels from UI Tree when possible
- Preserve original language from UI Tree (do not translate labels)
- Do NOT use alternation patterns like "A|B|C"

Response must be valid JSON matching this exact structure:
{
  "hypothesis": "why this bug occurs",
  "network": {
    "latencyMs": 1000,
    "forceHttpStatus": 500
  },
  "steps": [
    {
      "action": "tap|input|swipe|pressKey|assert",
      "element": "selector or null",
      "text": "text to input or null",
      "direction": "UP|DOWN|LEFT|RIGHT (must use UPPERCASE)",
      "key": "key name or null"
    }
  ]
}

Use "network" only when the hypothesis requires network manipulation; otherwise set it to null or omit it.

Return ONLY the JSON object, no markdown formatting or explanation.`;
}
