import { logLevel, logLevels, type LogLevel } from '../../config/environment';
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestLogContext = new AsyncLocalStorage<string>();

/** 状態コードを使って認証拒否や入力エラーとサーバー障害を分ける */
export function requestLogLevel(status: number) {
    return status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
}

/**
 * 明示的に選んだ診断項目を1行の JSON として出力する
 *
 * 呼び出し元から URL・SQL・例外本文・業務データを渡さない
 */
export function logEvent(
    level: LogLevel,
    event: string,
    details: {
        method?: string;
        route?: string;
        status?: number;
        elapsedMs?: number;
        reason?: string;
    } = {}
) {
    if (logLevels[level] < logLevels[logLevel()]) return;
    console[level](
        JSON.stringify({
            at: new Date().toISOString(),
            level,
            event,
            requestId: requestLogContext.getStore(),
            ...details
        })
    );
}
