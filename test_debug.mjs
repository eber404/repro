import { spawn } from 'child_process';
import { join } from 'path';

const maestroPath = join(process.cwd(), 'maestro', 'maestro', 'bin', 'maestro');
console.log('Maestro path:', maestroPath);

const args = ['--platform', 'ios', '--udid', '2F7F762C-EA81-4201-B5B2-9307B26AE61B', 'hierarchy'];
console.log('Args:', args);

const proc = spawn(maestroPath, args);
let stdout = '';
let stderr = '';

proc.stdout.on('data', d => stdout += d.toString());
proc.stderr.on('data', d => {
  stderr += d.toString();
  console.log('stderr:', d.toString().substring(0, 100));
});

proc.on('close', code => {
  console.log('Exit code:', code);
  console.log('Stdout length:', stdout.length);
  if (stdout.length > 0) {
    console.log('Stdout preview:', stdout.substring(0, 200));
  }
});

proc.on('error', err => {
  console.log('Error:', err.message);
});
