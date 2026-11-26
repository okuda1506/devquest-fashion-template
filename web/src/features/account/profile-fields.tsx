import type { CustomerProfile } from './account.types';

/**
 * 会員登録と会員情報編集で共通の入力欄を表示する
 */
export function ProfileFields({ profile }: { profile?: CustomerProfile }) {
    return (
        <>
            <div className="account-field-pair">
                <label>姓<input name="lastName" autoComplete="family-name" maxLength={50} defaultValue={profile?.lastName} required /></label>
                <label>名<input name="firstName" autoComplete="given-name" maxLength={50} defaultValue={profile?.firstName ?? ''} required={!profile} /></label>
            </div>
            <div className="account-field-pair">
                <label>セイ（任意）<input name="lastNameKana" maxLength={80} defaultValue={profile?.lastNameKana ?? ''} /></label>
                <label>メイ（任意）<input name="firstNameKana" maxLength={80} defaultValue={profile?.firstNameKana ?? ''} /></label>
            </div>
            <label>
                メールアドレス
                <input type="email" name="email" autoComplete="username" maxLength={254} defaultValue={profile?.email} required />
            </label>
            <label>
                電話番号（任意）
                <input type="tel" name="phone" autoComplete="tel" placeholder="090-1234-5678"
                    pattern="([0-9]-?){9,10}[0-9]" maxLength={14} defaultValue={profile?.phone ?? ''} />
            </label>
        </>
    );
}
