export type Surface = 'store' | 'admin';

/** 画面用途ごとに既定値と環境変数から許可オリジンを求める */
export function allowedOrigins(surface: Surface) {
    const port = surface === 'store' ? 5174 : 5175;
    const configured = surface === 'store' ? process.env.THREAD_STORE_ORIGINS : process.env.THREAD_ADMIN_ORIGINS;
    return (
        configured
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean) ?? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
    );
}
