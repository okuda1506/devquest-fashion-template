import { spawnSync } from 'node:child_process';

const branches = ['task/DEV-101', 'task/DEV-102', 'task/DEV-103', 'task/DEV-104'];
const target = branches.indexOf(process.argv[2]);
if (target < 0) {
  console.error('実装済みの課題に対応する作業ブランチを指定してください。');
  process.exit(2);
}

function run(args) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit' });
  if (result.error) console.error('テストを起動できませんでした。', result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const webFiles = branches.slice(0, Math.min(target + 1, 3)).map(branch => 'grading/' + branch.slice(5).toLowerCase() + '.web.test.tsx');
console.log('対象課題と、完了済み課題の回帰テストを実行します。');
run(['exec', '--', 'vitest', 'run', '--config', 'grading/vite.config.ts', ...webFiles]);
if (target === 3) run(['exec', '--', 'jest', '--runInBand', '--config', 'grading/jest.config.cjs']);
console.log('課題別のテストに合格しました。');
