import { ReproContext } from '@/context';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;

export async function compile(ctx: ReproContext): Promise<ReproContext> {
  console.log('   🛠️ Compiling to YAML...');

  if (!ctx.plan?.steps) {
    ctx.error = 'Compiler requires plan with steps';
    return ctx;
  }

  const flowDir = ctx.flowDir;
  if (!existsSync(flowDir)) {
    mkdirSync(flowDir, { recursive: true });
  }

  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const flowFile = join(flowDir, `${hash}.yaml`);

  let yaml = `# repro-generated: ${ctx.bug}\n`;
  yaml += `# Platform: ${ctx.platform}\n\n`;
  yaml += `appId: ${ctx.appPath}\n`;
  yaml += `---\n`;
  yaml += `flows:\n`;
  yaml += `  - flow:\n`;
  yaml += `      name: Repro flow\n`;
  yaml += `      steps:\n`;

  for (const step of ctx.plan.steps) {
    yaml += `        ${compileStepToYaml(step)}`;
  }

  writeFileSync(flowFile, yaml);
  ctx.flowFile = flowFile;

  return ctx;
}

function compileStepToYaml(step: { action: string; element?: string; text?: string; direction?: string }): string {
  switch (step.action) {
    case 'tap':
      return `- tapOn: "${step.element}"\n`;
    case 'input':
      return `- inputText: "${step.text}"\n`;
    case 'swipe':
      return `- swipe: "${step.direction}"\n`;
    case 'pressKey':
      return `- pressKey: "${step.element}"\n`;
    case 'assert':
      return `- assertVisible: "${step.element}"\n`;
    default:
      return `# Unknown action: ${step.action}`;
  }
}
