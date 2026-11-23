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

const mode = process.argv[3];
if (mode && !['1', '2', '3', 'regression'].includes(mode)) {
    console.error('完了条件の番号（1〜3）または regression を指定してください。');
    process.exit(2);
}

const selected =
    mode === 'regression' ? branches.slice(0, target) : mode ? [branches[target]] : branches.slice(0, target + 1);
const nameFilter = mode && mode !== 'regression' ? ['-t', 'criterion-' + mode + ':'] : [];
const webFiles = selected
    .filter((branch) => branch !== branches[3])
    .map((branch) => 'grading/' + branch.slice(5).toLowerCase() + '.web.test.tsx');
if (webFiles.length)
    run(['exec', '--', 'vitest', 'run', '--config', 'grading/vite.config.ts', ...nameFilter, ...webFiles]);
if (selected.includes(branches[3]))
    run(['exec', '--', 'jest', '--runInBand', '--config', 'grading/jest.config.cjs', ...nameFilter]);
