import { runPipeline } from './dist/index.js';

const ctx = {
  bug: 'test bug',
  appPath: 'com.test.app',
  deviceId: '2F7F762C-EA81-4201-B5B2-9307B26AE61B',
  platform: 'ios',
  maxRetries: 1,
  flowDir: './test-flows',
  resetStrategy: 'clear-app-data',
  maestroPath: '/Users/eber/dev/repro/maestro/maestro/bin/maestro',
  uiTree: null,
  plan: null,
  flowFile: null,
  executionResult: null,
  executionReport: null,
  reproduced: null,
  refinement: null,
  error: null,
  attempt: 1
};

console.log('Starting pipeline...');
console.log('maestroPath:', ctx.maestroPath);

runPipeline(ctx).then(result => {
  console.log('Pipeline done!');
  console.log('Result:', JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('Pipeline error:', err);
});
