import { spawn } from 'node:child_process';

process.env.ANALYZE = 'true';
const child = spawn('pnpm', ['build'], { stdio: 'inherit', shell: true, env: process.env });
child.on('close', (code) => {
  process.exit(code ?? 1);
});
