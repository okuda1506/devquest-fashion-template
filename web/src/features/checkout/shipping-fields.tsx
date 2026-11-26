import { useId } from 'react';
import type { ShippingAddress } from '@thread/shared';

const prefectures =
    '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(
        ' '
    );

/**
 * 購入手続きとアドレス帳で共通のお届け先入力欄を表示する
 */
export function ShippingFields({ address }: { address?: ShippingAddress }) {
    const prefectureLabel = useId();
    return (
        <>
            <label>
                お名前
                <input
                    name="name"
                    autoComplete="shipping name"
                    maxLength={100}
                    defaultValue={address?.name}
                    required
                />
            </label>
            <div className="checkout-fields">
                <label>
                    郵便番号
                    <input
                        name="postalCode"
                        autoComplete="shipping postal-code"
                        inputMode="numeric"
                        placeholder="100-0001"
                        pattern="[0-9]{3}-?[0-9]{4}"
                        maxLength={8}
                        defaultValue={address?.postalCode}
                        required
                    />
                </label>
                <label>
                    <span id={prefectureLabel}>都道府県</span>
                    <select
                        aria-labelledby={prefectureLabel}
                        name="prefecture"
                        autoComplete="shipping address-level1"
                        defaultValue={address?.prefecture ?? ''}
                        required
                    >
                        <option value="">選択してください</option>
                        {prefectures.map((prefecture) => (
                            <option key={prefecture}>{prefecture}</option>
                        ))}
                    </select>
                </label>
            </div>
            <label>
                市区町村
                <input
                    name="city"
                    autoComplete="shipping address-level2"
                    maxLength={100}
                    defaultValue={address?.city}
                    required
                />
            </label>
            <label>
                番地
                <input
                    name="line1"
                    autoComplete="shipping address-line1"
                    maxLength={120}
                    defaultValue={address?.line1}
                    required
                />
            </label>
            <label>
                建物名・部屋番号（任意）
                <input
                    name="line2"
                    autoComplete="shipping address-line2"
                    maxLength={120}
                    defaultValue={address?.line2}
                />
            </label>
            <label>
                電話番号
                <input
                    name="phone"
                    type="tel"
                    autoComplete="shipping tel"
                    placeholder="090-1234-5678"
                    pattern="([0-9]-?){9,10}[0-9]"
                    maxLength={14}
                    defaultValue={address?.phone}
                    required
                />
            </label>
        </>
    );
}

/**
 * お届け先入力欄の値を注文・アドレス帳で使う形式に変換する
 */
export function readShippingAddress(form: HTMLFormElement): ShippingAddress {
    const data = new FormData(form);
    const field = (name: keyof ShippingAddress) => String(data.get(name) ?? '').trim();
    return {
        name: field('name'),
        postalCode: field('postalCode'),
        prefecture: field('prefecture'),
        city: field('city'),
        line1: field('line1'),
        line2: field('line2'),
        phone: field('phone')
    };
}
