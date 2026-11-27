export const requestIdHeader = 'X-Thread-Request-Id';

export const logEvents = {
    response: 'http.response',
    exception: 'http.exception',
    query: 'db.query',
    orderPlaced: 'orders.place',
    paymentStarted: 'payments.started',
    paymentSucceeded: 'payments.succeeded',
    paymentFailed: 'payments.failed'
} as const;
