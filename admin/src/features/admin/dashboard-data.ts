import type { Order } from '@thread/shared';

export const dayCountOptions = [7, 30] as const;
export type DayCount = (typeof dayCountOptions)[number];
export type Metric = 'orders' | 'revenue';

const dayMs = 24 * 60 * 60 * 1000;
const japanOffsetMs = 9 * 60 * 60 * 1000;
export const shortDate = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
export const orderDate = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

/**
 * 受注を日本時間の暦日で区切ってダッシュボード用に集計する
 *
 * 注文がない日も件数と売上がゼロの点として残す
 *
 * @param orders 集計に含める候補の受注
 * @param period 今日を含む表示日数
 * @param now 集計の基準時刻。省略時は現在時刻
 * @returns 日ごとの件数と売上および期間内の状態別件数
 */
export function summarizeOrders(orders: readonly Order[], period: DayCount, now = Date.now()) {
    // 利用端末のタイムゾーンによらず日本時間の日付境界で受注を集計する
    const today = Math.floor((now + japanOffsetMs) / dayMs);
    const firstDay = today - period + 1;
    const days = Array.from({ length: period }, (_, index) => ({
        date: new Date((firstDay + index) * dayMs - japanOffsetMs),
        orders: 0,
        revenue: 0
    }));
    let pending = 0;
    let shipped = 0;
    let revenue = 0;
    for (const order of orders) {
        const day = days[Math.floor((Date.parse(order.createdAt) + japanOffsetMs) / dayMs) - firstDay];
        if (!day) continue;
        day.orders += 1;
        day.revenue += order.total;
        revenue += order.total;
        if (order.status === 'PLACED') pending += 1;
        else if (order.status === 'SHIPPED') shipped += 1;
    }
    return { days, orders: pending + shipped, revenue, pending, shipped };
}

/**
 * 受注グラフに表示する目盛りの間隔を算出する
 *
 * @param max グラフに含める最大値
 * @returns 1 以上の読みやすい目盛り間隔
 */
export function chartStep(max: number) {
    if (max === 0) return 1;
    const rough = max / 4;
    const base = 10 ** Math.floor(Math.log10(rough));
    const multiplier = [1, 2, 5, 10].find((value) => value * base >= rough) ?? 10;
    return Math.max(1, Math.ceil(multiplier * base));
}
