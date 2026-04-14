import { AgentType, spawnAgent } from '@/agents/cli';
import { ReproContext } from '@/context';

const SCREEN_ANALYZER_AGENT = (process.env.REPRO_LOGIN_AGENT || process.env.REPRO_AGENT || 'claude') as AgentType;
const SCREEN_ANALYZER_TIMEOUT_MS = 60_000;

interface ScreenAnalyzerResponse {
  screenAnalysis?: string;
  loginBootstrapYaml?: string;
}

export async function analyzeScreenWithAi(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🖼️ Analyzing visible screen with AI...');

  if (!ctx.uiTree) {
    ctx.error = 'analyzeScreenWithAi requires uiTree from gatherContext';
    return ctx;
  }

  if (!ctx.visibleScreenshotPath) {
    ctx.error = 'analyzeScreenWithAi requires visibleScreenshotPath from gatherContext';
    return ctx;
  }

  try {
    const prompt = buildScreenAnalyzerPrompt(ctx);
    const responseText = await spawnAgent(
      prompt,
      SCREEN_ANALYZER_AGENT,
      SCREEN_ANALYZER_TIMEOUT_MS,
      [ctx.visibleScreenshotPath]
    );

    const parsed = parseScreenAnalyzerResponse(responseText);
    ctx.screenAnalysis = parsed.screenAnalysis || '';

    if (!hasCredentials(ctx)) {
      return ctx;
    }

    const loginYaml = parsed.loginBootstrapYaml?.trim();
    if (!loginYaml) {
      ctx.error = 'analyzeScreenWithAi missing loginBootstrapYaml when credentials are configured';
      return ctx;
    }

    ctx.loginBootstrapYaml = loginYaml;
  } catch (error) {
    ctx.error = `analyzeScreenWithAi failed: ${(error as Error).message}`;
  }

  return ctx;
}

export function buildScreenAnalyzerPrompt(ctx: ReproContext): string {
  const credentialsHint = hasCredentials(ctx)
    ? '\nCredentials are configured. Include loginBootstrapYaml with Maestro commands for automatic login.'
    : '\nCredentials are NOT configured. Do not include loginBootstrapYaml.';

  return `You analyze a mobile app visible screen using hierarchy JSON plus a screenshot file.

Rules:
- Use only information from provided hierarchy and screenshot.
- Keep output in valid JSON only.
- Never invent selectors not present in UI context.
- Preserve UI language exactly.

Bug description:
${ctx.enhancedBugDescription || ctx.bug}

UI hierarchy JSON:
${JSON.stringify(ctx.uiTree, null, 2)}
${credentialsHint}

Return JSON with this shape:
{
  "screenAnalysis": "short analysis",
  "loginBootstrapYaml": "optional Maestro YAML string"
}`;
}

function parseScreenAnalyzerResponse(rawResponse: string): ScreenAnalyzerResponse {
  const jsonText = extractJsonPayload(rawResponse);
  return JSON.parse(jsonText) as ScreenAnalyzerResponse;
}

function extractJsonPayload(response: string): string {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return response.slice(firstBrace, lastBrace + 1).trim();
  }

  return response.trim();
}

function hasCredentials(ctx: ReproContext): boolean {
  return Boolean(ctx.credentials?.email && ctx.credentials?.password);
}
