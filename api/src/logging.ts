import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';

type RoutedRequest = IncomingMessage & { route?: { path?: unknown } };

const context = new AsyncLocalStorage<string>();
const levels = { debug: 0, info: 1, warn: 2, error: 3 };

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
    level: keyof typeof levels,
    event: string,
    details: {
        method?: string;
        route?: string;
        status?: number;
        elapsedMs?: number;
        reason?: string;
    } = {}
) {
    const configured = process.env.THREAD_LOG_LEVEL;
    const threshold =
        configured && Object.hasOwn(levels, configured)
            ? levels[configured as keyof typeof levels]
            : levels[process.env.NODE_ENV === 'test' ? 'error' : 'info'];
    if (levels[level] < threshold) return;
    console[level](
        JSON.stringify({ at: new Date().toISOString(), level, event, requestId: context.getStore(), ...details })
    );
}

/**
 * ID をリクエスト処理に関連付けてブラウザと API のログを照合できるようにする
 *
 * 動的な商品 ID や検索語を含まない Express のルート定義だけを記録する
 */
export function traceRequest(request: RoutedRequest, response: ServerResponse, next: () => void) {
    const supplied = request.headers['x-thread-request-id'];
    const requestId =
        typeof supplied === 'string' &&
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(supplied)
            ? supplied
            : randomUUID();
    const started = performance.now();
    response.setHeader('x-thread-request-id', requestId);
    response.once('finish', () =>
        context.run(requestId, () =>
            logEvent(requestLogLevel(response.statusCode), 'http.response', {
                method: request.method,
                route: typeof request.route?.path === 'string' ? request.route.path : '(unmatched)',
                status: response.statusCode,
                elapsedMs: Math.round(performance.now() - started)
            })
        )
    );
    context.run(requestId, next);
}

/** 未処理の例外の本文やスタックを出力せずに汎用の 500 応答を返す */
@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
    /** 既知の HTTP エラーは NestJS 標準の応答形式で返す */
    override catch(exception: unknown, host: ArgumentsHost) {
        if (exception instanceof HttpException) {
            super.catch(exception, host);
            return;
        }
        logEvent('error', 'http.exception', { reason: 'unexpected_failure' });
        const response = host.switchToHttp().getResponse<ServerResponse>();
        if (response.headersSent) {
            response.end();
            return;
        }
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ statusCode: 500, message: 'Internal server error' }));
    }
}
