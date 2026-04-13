import { ReproContext } from '@/context';
import { spawnAgent } from '@/agents/cli';

const { writeFileSync, mkdirSync, existsSync } = require('fs');

const AGENT_ENV = process.env.REPRO_AGENT || 'gemini';
const DETECTOR_TIMEOUT_MS = 60_000;

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

async function readScreenshotBase64(path: string): Promise<string> {
  const file = Bun.file(path);
  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function takeScreenshotIOS(screenshotPath: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ['xcrun', 'simctl', 'io', 'booted', 'screenshot', screenshotPath]
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`iOS screenshot failed with code ${code}`);
  }
}

async function takeScreenshotAndroid(screenshotPath: string): Promise<void> {
  const tmpPath = '/sdcard/screen.png';

  const capProc = Bun.spawn({
    cmd: ['adb', 'shell', 'screencap', '-p', tmpPath]
  });
  const capCode = await capProc.exited;
  if (capCode !== 0) {
    throw new Error(`Android screenshot capture failed with code ${capCode}`);
  }

  const pullProc = Bun.spawn({
    cmd: ['adb', 'pull', tmpPath, screenshotPath]
  });
  const pullCode = await pullProc.exited;
  if (pullCode !== 0) {
    throw new Error(`Android screenshot pull failed with code ${pullCode}`);
  }
}

async function launchAppAndWait(ctx: ReproContext, screenshotPath: string): Promise<void> {
  const detectFlow = `appId: ${ctx.appPath}
platform: ${ctx.platform}
---
- launchApp:
    appId: ${ctx.appPath}
    clearState: true
    clearKeychain: true
- waitForAnimationToEnd:
    timeout: 5000
`;

  const flowFile = `${process.cwd()}/${ctx.flowDir}/detect_login_flow.yaml`;
  writeFileSync(flowFile, detectFlow);

  const proc = Bun.spawn({
    cmd: [
      ctx.maestroPath,
      '--platform', ctx.platform,
      '--udid', ctx.deviceId!,
      'test',
      flowFile,
      '--no-reinstall-driver'
    ],
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);

  if (code !== 0) {
    throw new Error(`Launch app failed with code ${code}: ${stdout} ${stderr}`);
  }

  if (ctx.platform === 'ios') {
    await takeScreenshotIOS(screenshotPath);
  } else {
    await takeScreenshotAndroid(screenshotPath);
  }
}

export async function detectLoginFields(ctx: ReproContext): Promise<ReproContext> {
  if (!ctx.credentials?.email || !ctx.credentials?.password) {
    return ctx;
  }

  if (!ctx.deviceId) {
    ctx.error = 'Login detector requires deviceId';
    return ctx;
  }

  console.log('   🔍 Detecting login fields...');

  const screenshotDir = `${process.cwd()}/${ctx.flowDir}/screenshots`;
  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotPath = `${screenshotDir}/login_screen.png`;

  try {
    await launchAppAndWait(ctx, screenshotPath);
    const screenshotBase64 = await readScreenshotBase64(screenshotPath);

    const prompt = `Analyze this app screenshot and identify the login form fields.

Return ONLY valid JSON (no markdown) with the exact structure:
{
  "emailField": "The visible text/placeholder for the email/username field",
  "passwordField": "The visible text/placeholder for the password field",
  "loginButton": "The visible text on the login/submit button"
}

Examples:
- If you see "Email" label above a field, return "Email"
- If you see "Digite seu email" placeholder, return "Digite seu email"
- If button says "Entrar", return "Entrar"

Return ONLY the JSON object.`;

    const result = await spawnAgent(
      prompt + `\n\n[Screenshot as base64 - first 100 chars]: ${screenshotBase64.substring(0, 100)}...`,
      AGENT_ENV as 'gemini' | 'claude' | 'codex' | 'opencode',
      DETECTOR_TIMEOUT_MS
    );

    const jsonText = extractJson(result);
    const parsed = JSON.parse(jsonText);

    ctx.loginFlow = {
      emailField: parsed.emailField,
      passwordField: parsed.passwordField,
      loginButton: parsed.loginButton
    };

    console.log(`   ✅ Login fields detected: ${parsed.emailField}, ${parsed.passwordField}, ${parsed.loginButton}`);
  } catch (err) {
    ctx.error = `Login detection failed: ${(err as Error).message}`;
  }

  return ctx;
}
