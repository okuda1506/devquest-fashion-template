export const requestIdHeader = 'X-Thread-Request-Id';

export const logEvents = {
    response: 'http.response',
    exception: 'http.exception',
    query: 'db.query',
    orderPlaced: 'orders.place'
} as const;
