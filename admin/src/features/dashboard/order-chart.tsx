import { useRef, useState, type KeyboardEvent } from 'react';
import { yen } from '@thread/shared';
import { chartStep, shortDate, type Metric, type summarizeOrders } from './dashboard-data';

const labels = { orders: '受注数', revenue: '受注金額' };
/** 注文数と売上をそれぞれの単位で表示する */
const formatMetric = (metric: Metric, value: number) =>
    metric === 'orders' ? `${value.toLocaleString('ja-JP')} 件` : yen(value);

type DailyOrders = ReturnType<typeof summarizeOrders>['days'];

/** 日別の注文数と売上を切り替えて受注の推移を表示する */
export function OrderChart({ days }: { days: DailyOrders }) {
    const [metric, setMetric] = useState<Metric>('orders');
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const buttons = useRef<Array<HTMLButtonElement | null>>([]);
    const selectedIndex = days.findIndex((day) => day.date.getTime() === selectedDate);
    const lastWithOrders = days.reduce((last, day, index) => (day.orders > 0 ? index : last), 0);
    const activeIndex = selectedIndex < 0 ? lastWithOrders : selectedIndex;
    const active = days[activeIndex];
    const step = chartStep(Math.max(...days.map((day) => day[metric])));
    const axis = [4, 3, 2, 1, 0].map((level) => level * step);
    const max = axis[0];
    const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

    // 矢印キーで隣接する日付へのフォーカスを移す
    function navigateDay(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        let next: number;
        switch (event.key) {
            case 'ArrowLeft':
                next = Math.max(0, index - 1);
                break;
            case 'ArrowRight':
                next = Math.min(days.length - 1, index + 1);
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = days.length - 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        buttons.current[next]?.focus();
    }

    return (
        <>
            <div className="order-chart-toolbar">
                <div className="dashboard-options" role="group" aria-label="グラフの指標">
                    <button type="button" aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>
                        受注数
                    </button>
                    <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>
                        受注金額
                    </button>
                </div>
                <p className="order-chart-selected">
                    <time dateTime={active.date.toISOString()}>{shortDate.format(active.date)}</time>
                    <strong>{formatMetric(metric, active[metric])}</strong>
                </p>
            </div>
            <div className="order-chart">
                <div className="order-chart-axis" aria-hidden="true">
                    {axis.map((value) => (
                        <span key={value}>{metric === 'revenue' ? yen(value) : value.toLocaleString('ja-JP')}</span>
                    ))}
                </div>
                <div className="order-chart-bars" role="group" aria-label={`日別の${labels[metric]}`} style={columns}>
                    {days.map((day, index) => (
                        <button
                            type="button"
                            key={day.date.getTime()}
                            ref={(element) => {
                                buttons.current[index] = element;
                            }}
                            aria-label={`${shortDate.format(day.date)} ${formatMetric(metric, day[metric])}`}
                            aria-pressed={activeIndex === index}
                            tabIndex={activeIndex === index ? 0 : -1}
                            onClick={() => setSelectedDate(day.date.getTime())}
                            onFocus={() => setSelectedDate(day.date.getTime())}
                            onKeyDown={(event) => navigateDay(event, index)}
                        >
                            <span aria-hidden="true" style={{ height: `${(day[metric] / max) * 100}%` }} />
                        </button>
                    ))}
                </div>
                <div className="order-chart-dates" style={columns} aria-hidden="true">
                    {days.map((day, index) => (
                        <span key={day.date.getTime()}>
                            {(days.length === 7 ||
                                (index % 7 === 0 && index < days.length - 4) ||
                                index === days.length - 1) &&
                                shortDate.format(day.date)}
                        </span>
                    ))}
                </div>
            </div>
            <details className="chart-values">
                <summary>日別の数値を表示</summary>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">日付</th>
                            <th scope="col">受注数</th>
                            <th scope="col">受注金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr key={day.date.getTime()}>
                                <th scope="row">{shortDate.format(day.date)}</th>
                                <td>{day.orders} 件</td>
                                <td>{yen(day.revenue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </>
    );
}
