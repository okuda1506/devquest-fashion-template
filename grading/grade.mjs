import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const chapters = JSON.parse(readFileSync(new URL('quest-order.json', import.meta.url), 'utf8'));
const ids = chapters.flat();
const target = ids.indexOf(process.argv[2]?.replace(/^task\//, ''));
const mode = process.argv[3];
if (target < 0 || (mode && !['1', '2', '3', 'regression'].includes(mode))) {
    console.error('課題ブランチと採点モードを指定してください（例 task/DEV-101 1）');
    process.exit(2);
}

function run(args) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit' });
    if (result.error) console.error('テストを起動できませんでした。', result.error.message);
    return result.status ?? 1;
}

const condition = ['1', '2', '3'].includes(mode) ? mode : undefined;
const selected = mode === 'regression' ? ids.slice(0, target) : condition ? [ids[target]] : ids.slice(0, target + 1);
const originalWeb = ['DEV-101', 'DEV-102', 'DEV-103'].filter((id) => selected.includes(id));
const originalApi = selected.includes('DEV-104');

// 新旧のテストを分けて実行し、旧課題の条件名もそのまま受け入れる
const apiCriteria = new Map([
    ...[105, 106, 108, 110, 111, 115, 116, 119, 120, 125, 126, 127, 128, 129, 130, 136, 137, 138, 139, 140].map(
        (id) => [`DEV-${id}`, '123']
    ),
    ['DEV-109', '1'],
    ['DEV-117', '12'],
    ['DEV-135', '12']
]);
const newIds = selected.filter((id) => Number(id.slice(4)) >= 105);
const web = (files, filter) =>
    run(['exec', '--', 'vitest', 'run', '--config', 'grading/vite.config.ts', ...files, ...filter]);
const api = (files, filter) =>
    run([
        'exec',
        '--',
        'jest',
        '--runInBand',
        '--config',
        'grading/jest.config.cjs',
        '--runTestsByPath',
        ...files,
        ...filter
    ]);
const failures = [];

if (originalWeb.length) {
    failures.push(
        web(
            originalWeb.map((id) => `grading/${id.toLowerCase()}.web.test.tsx`),
            condition ? ['-t', `criterion-${condition}:`] : []
        )
    );
}
if (originalApi) {
    failures.push(api(['grading/dev-104.api.test.ts'], condition ? ['-t', `criterion-${condition}:`] : []));
}
for (const [kind, runner] of [
    ['web', web],
    ['api', api]
]) {
    const checks = newIds.flatMap((id) => {
        const apiChecks = apiCriteria.get(id) ?? '';
        return [...(condition ?? '123')]
            .filter((index) => (kind === 'api') === apiChecks.includes(index))
            .map((index) => `${id} criterion-${index}:`);
    });
    if (checks.length)
        failures.push(
            runner([`grading/quests.${kind}.test.${kind === 'web' ? 'tsx' : 'ts'}`], ['-t', checks.join('|')])
        );
}
if (failures.some((status) => status !== 0)) process.exit(1);
