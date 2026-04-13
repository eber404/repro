import { ReproContext } from '@/context';
import { spawnAgent } from '@/agents/cli';

const EVAL_AGENT = process.env.REPRO_EVAL_AGENT || process.env.REPRO_AGENT || 'claude';
const EVAL_TIMEOUT_MS = 60_000;

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  if (text.includes('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (end > start) return text.substring(start, end + 1);
  }
  throw new Error('No JSON found in response');
}

export async function evaluate(ctx: ReproContext): Promise<ReproContext> {
  console.log('   ⚖️ Evaluating...');

  if (!ctx.executionResult || !ctx.executionReport) {
    ctx.error = 'Evaluator requires executionResult and executionReport';
    return ctx;
  }

  const prompt = buildEvaluatorPrompt(ctx);

  try {
    const result = await spawnAgent(prompt, EVAL_AGENT as 'gemini' | 'claude' | 'codex' | 'opencode', EVAL_TIMEOUT_MS);
    const jsonText = extractJson(result);
    const parsed = JSON.parse(jsonText);
    ctx.reproduced = parsed.reproduced;
    if (typeof parsed.reason === 'string') {
      ctx.executionReport.anomalies = [...ctx.executionReport.anomalies, `evaluation: ${parsed.reason}`];
    }
  } catch (err) {
    ctx.error = `Eval agent failed: ${err}`;
  }

  return ctx;
}

export function buildEvaluatorPrompt(ctx: ReproContext): string {
  const executionResult = ctx.executionResult;
  const executionReport = ctx.executionReport;
  if (!executionResult || !executionReport) {
    throw new Error('buildEvaluatorPrompt requires executionResult and executionReport');
  }

  return `Bug description: "${ctx.bug}"
Execution result: ${executionResult.success ? 'SUCCESS' : 'FAILURE'}
Execution output: ${executionResult.output}
Execution report timestamp: ${executionReport.timestamp}
Execution report log excerpt:
${executionReport.logExcerpt}
Execution report anomalies: ${executionReport.anomalies.join(', ') || 'none'}
Execution report screenshots: ${executionReport.screenshots.join(', ') || 'none'}
Execution report flow file: ${executionReport.flowFile}

Analyze the execution and determine if the bug was reproduced.

CRITICAL: Response must be ONLY valid JSON, no markdown formatting:
{"reproduced": true, "reason": "brief explanation of why bug was or wasn't reproduced"}

Do NOT use YAML. Do NOT use markdown code blocks. Return only raw JSON.`;
}
