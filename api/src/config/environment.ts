export const logLevels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
export type LogLevel = keyof typeof logLevels;

const frontendPorts = { store: 5174, admin: 5175 } as const;
export type Surface = keyof typeof frontendPorts;

export function apiPort() {
    const port = Number(process.env.THREAD_PORT ?? 3001);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('THREAD_PORT に0〜65535の整数を指定してください。');
    }
    return port;
}

export function databaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL を指定してください。');
    return url;
}

export function jwtSecret() {
    const secret = process.env.THREAD_JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            'リポジトリ直下の .env または環境変数の THREAD_JWT_SECRET に32文字以上の値を設定し、API を再起動してください。'
        );
    }
    return secret;
}

export function logLevel(): LogLevel {
    const configured = process.env.THREAD_LOG_LEVEL;
    if (configured && Object.hasOwn(logLevels, configured)) return configured as LogLevel;
    return process.env.NODE_ENV === 'test' ? 'error' : 'info';
}

export function allowedOrigins(surface: Surface) {
    const configured = surface === 'store' ? process.env.THREAD_STORE_ORIGINS : process.env.THREAD_ADMIN_ORIGINS;
    const port = frontendPorts[surface];
    return (
        configured
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean) ?? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
    );
}
