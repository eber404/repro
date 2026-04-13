import { ReproContext } from '@/context';

const { mkdirSync, writeFileSync } = require('fs');

export async function generateReport(ctx: ReproContext): Promise<void> {
  const reportDir = ctx.flowDir;

  mkdirSync(reportDir, { recursive: true });

  const reproAttempts = ctx.reproduced ? 1 : 0;
  const totalAttempts = ctx.attempt;

  const report = {
    bugDescription: ctx.bug,
    reproRate: `${reproAttempts}/${totalAttempts}`,
    flowFile: ctx.flowFile,
    hypothesis: ctx.plan?.hypothesis || 'Unknown',
    attempts: ctx.attempt,
    runDir: reportDir
  };

  const reportFile = `${reportDir}/report.json`;
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📄 Report saved to: ${reportFile}`);
}

export function printSummary(ctx: ReproContext): void {
  console.log('\n========== REPRO SUMMARY ==========');
  console.log(`Bug: ${ctx.bug}`);
  console.log(`Reproduced: ${ctx.reproduced ? '✅ YES' : '❌ NO'}`);
  console.log(`Flow file: ${ctx.flowFile}`);
  console.log(`Attempts: ${ctx.attempt}`);
  console.log('===================================');
}
