import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { ServerResponse } from 'node:http';
import { logEvents } from '../logging/log-events';
import { logEvent } from '../logging/logger';
import { httpMessages } from '../http-messages';

/**
 * 未処理の例外の本文やスタックを出力せずに汎用の 500 応答を返す
 */
@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
    /**
     * 既知の HTTP エラーは NestJS 標準の応答形式で返す
     */
    override catch(exception: unknown, host: ArgumentsHost) {
        if (exception instanceof HttpException) {
            super.catch(exception, host);
            return;
        }
        logEvent('error', logEvents.exception, { reason: 'unexpected_failure' });
        const response = host.switchToHttp().getResponse<ServerResponse>();
        if (response.headersSent) {
            response.end();
            return;
        }
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ statusCode: 500, message: httpMessages.internalError }));
    }
}
