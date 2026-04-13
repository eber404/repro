import { ReproContext } from '@/context';

const { mkdirSync, writeFileSync } = require('fs');

const HASH_LENGTH = 8;

export async function generateReport(ctx: ReproContext): Promise<void> {
  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const reportDir = `${ctx.flowDir}/${hash}`;

  mkdirSync(reportDir, { recursive: true });

  const reproAttempts = ctx.reproduced ? 1 : 0;
  const totalAttempts = ctx.attempt;

  const report = {
    bugDescription: ctx.bug,
    reproRate: `${reproAttempts}/${totalAttempts}`,
    flowFile: ctx.flowFile,
    hypothesis: ctx.plan?.hypothesis || 'Unknown',
    attempts: ctx.attempt,
    screenshotsDir: `${reportDir}/screenshots`,
    logsDir: `${reportDir}/logs`
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
