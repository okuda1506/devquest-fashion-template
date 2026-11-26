export const environmentMessages = {
    invalidPort: 'THREAD_PORT に0〜65535の整数を指定してください。',
    databaseRequired: 'DATABASE_URL を指定してください。',
    invalidJwtSecret: 'リポジトリ直下の .env または環境変数の THREAD_JWT_SECRET に32文字以上の値を設定し、API を再起動してください。'
} as const;
