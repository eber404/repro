import { ReproContext } from '@/context';

const { writeFileSync, mkdirSync, existsSync } = require('fs');

interface UIElement {
  text?: string;
  contentDescription?: string;
  resourceId?: string;
  hint?: string;
  className?: string;
}

async function launchAppAndWait(ctx: ReproContext): Promise<void> {
  console.log('   📝 Creating detect_login_flow.yaml...');
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
  console.log(`   📄 Flow file: ${flowFile}`);

  console.log(`   ▶️ Running maestro test...`);
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

  console.log(`   📤 Maestro exit code: ${code}`);
  if (code !== 0) {
    console.log(`   📤 stdout: ${stdout.substring(0, 300)}`);
    console.log(`   📤 stderr: ${stderr.substring(0, 300)}`);
  }
}

async function getHierarchy(ctx: ReproContext): Promise<UIElement[]> {
  console.log('   🔍 Getting UI hierarchy...');
  
  const proc = Bun.spawn({
    cmd: [
      ctx.maestroPath,
      '--platform', ctx.platform,
      '--udid', ctx.deviceId!,
      'hierarchy'
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
    console.log(`   ⚠️ Hierarchy failed: ${stderr}`);
    return [];
  }

  try {
    const jsonStart = stdout.indexOf('{');
    const jsonText = jsonStart >= 0 ? stdout.substring(jsonStart) : stdout;
    const hierarchy = JSON.parse(jsonText);
    
    const elements: UIElement[] = [];
    const tree = hierarchy.frame?.children || hierarchy;
    
    function traverse(node: any) {
      if (node.text) elements.push({ text: node.text });
      if (node.contentDescription) elements.push({ contentDescription: node.contentDescription });
      if (node.hint) elements.push({ hint: node.hint });
      if (node.resourceId) elements.push({ resourceId: node.resourceId });
      if (node.className) elements.push({ className: node.className });
      
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    
    traverse(tree);
    console.log(`   📊 Found ${elements.length} UI elements`);
    return elements;
  } catch (err) {
    console.log(`   ⚠️ Failed to parse hierarchy: ${err}`);
    return [];
  }
}

function detectLoginFieldsFromElements(elements: UIElement[]): { emailField: string; passwordField: string; loginButton: string } {
  let emailField = 'Email';
  let passwordField = 'Password';
  let loginButton = 'Sign In';

  const emailPatterns = ['email', 'usuario', 'username', 'user', 'e-mail', 'login'];
  const passwordPatterns = ['password', 'senha', 'passwd', 'pwd'];
  const buttonPatterns = ['sign in', 'login', 'entrar', 'log in', 'submit', 'acesso', 'entrar'];

  for (const el of elements) {
    const text = (el.text || el.contentDescription || el.hint || '').toLowerCase();
    const resourceId = (el.resourceId || '').toLowerCase();

    if (!emailField && emailPatterns.some(p => text.includes(p) || resourceId.includes(p))) {
      emailField = el.text || el.contentDescription || el.hint || 'Email';
    }

    if (!passwordField && passwordPatterns.some(p => text.includes(p) || resourceId.includes(p))) {
      passwordField = el.text || el.contentDescription || el.hint || 'Password';
    }

    if (buttonPatterns.some(p => text.includes(p) || resourceId.includes(p))) {
      loginButton = el.text || el.contentDescription || el.hint || 'Sign In';
    }
  }

  return { emailField, passwordField, loginButton };
}

export async function detectLoginFields(ctx: ReproContext): Promise<ReproContext> {
  if (!ctx.credentials?.email || !ctx.credentials?.password) {
    return ctx;
  }

  if (!ctx.deviceId) {
    ctx.error = 'Login detector requires deviceId';
    return ctx;
  }

  console.log('   🔍 Detecting login fields from UI hierarchy...');

  try {
    await launchAppAndWait(ctx);
    const elements = await getHierarchy(ctx);
    
    const fields = detectLoginFieldsFromElements(elements);
    
    ctx.loginFlow = fields;
    console.log(`   ✅ Login fields detected: ${fields.emailField}, ${fields.passwordField}, ${fields.loginButton}`);
  } catch (err) {
    console.log(`   ⚠️ Detection failed: ${(err as Error).message}`);
    ctx.loginFlow = {
      emailField: 'Email',
      passwordField: 'Password',
      loginButton: 'Sign In'
    };
    console.log(`   ✅ Using fallback login fields: Email, Password, Sign In`);
  }

  return ctx;
}
