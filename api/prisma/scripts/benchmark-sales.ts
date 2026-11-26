/** 大量 Seed の店舗管理レポートを繰り返し計測する */
async function benchmark() {
    const base = 'http://127.0.0.1:' + (process.env.THREAD_PORT ?? '3001') + '/api';
    const login = await fetch(base + '/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'thread-admin' })
    });
    if (!login.ok) throw new Error('標準 Seed の管理者でログインできませんでした。');
    const { token } = (await login.json()) as { token: string };
    const times: number[] = [];
    for (let run = 0; run < 6; run++) {
        const started = performance.now();
        const response = await fetch(base + '/admin/reports/product-sales?category=tops', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!response.ok) throw new Error('レポートを取得できませんでした。');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length < 25) {
            throw new Error('計測前に npm run db:seed:large で大量データを投入してください。');
        }
        const elapsed = Math.round(performance.now() - started);
        console.log(
            '対象 %d 件 / %d ms / requestId %s%s',
            rows.length,
            elapsed,
            response.headers.get('x-thread-request-id'),
            run === 0 ? '（ウォームアップ）' : ''
        );
        if (run > 0) times.push(elapsed);
    }
    console.log('ウォームアップを除いた中央値 %d ms', times.sort((a, b) => a - b)[2]);
}

benchmark().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : '計測に失敗しました。');
    process.exitCode = 1;
});
