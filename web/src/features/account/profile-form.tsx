import { useState, type FormEvent } from 'react';
import { api } from '@thread/shared';
import type { CustomerProfile } from './account.types';
import { ProfileFields } from './profile-fields';

/**
 * ログイン中の顧客が氏名と連絡先を更新できるフォームを表示する
 */
export function ProfileForm({ token, profile }: { token: string; profile: CustomerProfile }) {
    const [saved, setSaved] = useState(profile);
    const [email, setEmail] = useState(profile.email);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    /**
     * フォームの会員情報を保存して保存結果を表示する
     */
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const data = Object.fromEntries(new FormData(event.currentTarget));
        setError('');
        setNotice('');
        setBusy(true);
        try {
            const updated = await api<CustomerProfile>('/customers/me', {
                method: 'PATCH',
                body: JSON.stringify(data)
            }, token);
            setSaved(updated);
            setEmail(updated.email);
            setNotice('会員情報を保存しました。');
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="form" onSubmit={submit} onChange={(event) => {
            const input = event.target;
            if (input instanceof HTMLInputElement && input.name === 'email') setEmail(input.value);
            setNotice('');
        }}>
            <fieldset className="stack account-fields" disabled={busy}>
                <legend className="sr-only">会員情報</legend>
                <ProfileFields key={saved.email} profile={saved} />
                {email.trim().toLowerCase() !== saved.email && (
                    <label>
                        現在のパスワード（メールアドレス変更の確認）
                        <input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required />
                    </label>
                )}
                {error && <p role="alert">{error}</p>}
                {notice && <p role="status">{notice}</p>}
                <button type="submit">{busy ? '保存中…' : '会員情報を保存'}</button>
            </fieldset>
        </form>
    );
}
