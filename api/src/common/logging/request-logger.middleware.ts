import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { logEvent, requestLogContext, requestLogLevel } from './logger';

type RoutedRequest = IncomingMessage & { route?: { path?: unknown } };

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
        requestLogContext.run(requestId, () =>
            logEvent(requestLogLevel(response.statusCode), 'http.response', {
                method: request.method,
                route: typeof request.route?.path === 'string' ? request.route.path : '(unmatched)',
                status: response.statusCode,
                elapsedMs: Math.round(performance.now() - started)
            })
        )
    );
    requestLogContext.run(requestId, next);
}
