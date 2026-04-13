import { ReproContext } from '@/context';
import { gatherContext } from '@/stages/gatherContext';
import { plan } from '@/stages/planner';
import { compile } from '@/stages/compiler';
import { resetState } from '@/stages/stateManager';
import { execute } from '@/stages/executor';
import { observe } from '@/stages/observer';
import { evaluate } from '@/stages/evaluator';
import { refine } from '@/stages/refiner';

const PIPELINE_STAGES = [
  gatherContext,
  plan,
  compile,
  resetState,
  execute,
  observe,
  evaluate,
  refine
] as const;

export async function runPipeline(ctx: ReproContext): Promise<ReproContext> {
  let currentCtx = { ...ctx };

  for (let attempt = 1; attempt <= ctx.maxRetries; attempt++) {
    console.log(`\n📍 Attempt ${attempt}/${ctx.maxRetries}`);
    currentCtx.error = null;
    currentCtx.reproduced = null;
    currentCtx.attempt = attempt;

    for (const stage of PIPELINE_STAGES) {
      const stageStart = Date.now();

      try {
        currentCtx = await stage(currentCtx);
      } catch (e) {
        currentCtx.error = `${stage.name}: ${(e as Error).message}`;
      }

      if (currentCtx.error) {
        console.log(`   ❌ ${stage.name}: ${currentCtx.error}`);
        break;
      }

      console.log(`   ✅ ${stage.name} (${Date.now() - stageStart}ms)`);
    }

    if (currentCtx.reproduced === true) {
      console.log('\n✅ Bug reproduced successfully!');
      return currentCtx;
    }

    if (attempt < ctx.maxRetries && currentCtx.refinement) {
      console.log('\n🔄 Refining strategy...');
      currentCtx.attempt = attempt + 1;
      continue;
    }

    if (attempt === ctx.maxRetries) {
      console.log(`\n❌ Failed to reproduce after ${attempt} attempts`);
    }
  }

  return currentCtx;
}
