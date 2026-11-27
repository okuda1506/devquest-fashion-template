export const paymentMethodLabels = {
    CREDIT_CARD: 'クレジットカード（模擬）',
    CASH_ON_DELIVERY: '代金引換'
} as const;

export const paymentStatusLabels = {
    PAID: '決済済み',
    PENDING: '支払い待ち'
} as const;

export type PaymentMethod = keyof typeof paymentMethodLabels;
export type PaymentStatus = keyof typeof paymentStatusLabels;
