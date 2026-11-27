export const paymentMessages = {
    PAYMENT_DECLINED: '模擬決済が承認されませんでした。成功用のテストカードを選び直してお試しください。',
    PAYMENT_TEST_CARD_REQUIRED: '模擬決済にはテスト専用カードを選んでください。',
    PAYMENT_UNAVAILABLE: '決済処理を完了できませんでした。時間をおいてもう一度お試しください。',
    cardNotAllowed: '代金引換ではカード情報を指定できません。'
} as const;
