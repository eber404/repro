import { ReproContext } from '@/context';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const HASH_LENGTH = 8;

export function generateReport(ctx: ReproContext): void {
  const hash = ctx.bug.replace(/[^a-z0-9]/gi, '').substring(0, HASH_LENGTH);
  const reportDir = join(ctx.flowDir, hash);

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reproAttempts = ctx.reproduced ? 1 : 0;
  const totalAttempts = ctx.attempt;

  const report = {
    bugDescription: ctx.bug,
    reproRate: `${reproAttempts}/${totalAttempts}`,
    flowFile: ctx.flowFile,
    hypothesis: ctx.plan?.hypothesis || 'Unknown',
    attempts: ctx.attempt,
    screenshotsDir: join(reportDir, 'screenshots'),
    logsDir: join(reportDir, 'logs')
  };

  const reportFile = join(reportDir, 'report.json');
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