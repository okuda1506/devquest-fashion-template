/** 金額を日本円の表示文字列に整形する */
export const yen = (price: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(price);
