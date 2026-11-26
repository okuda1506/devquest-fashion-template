import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import type { CustomerProfile } from '../account/account.types';
import { ProfileFields } from '../account/profile-fields';
import { loginDestination } from './login-destination';

/**
 * EC の会員情報を登録してログイン画面へ戻る
 */
export function Register() {
    const { session, checking } = useSession();
    const returnTo = loginDestination(useLocation().state, '/account');
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    /**
     * 入力したパスワードを確認して顧客アカウントを作成する
     */
    async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const { passwordConfirmation, ...profile } = Object.fromEntries(new FormData(event.currentTarget));
        setError('');
        if (profile.password !== passwordConfirmation) {
            setError('確認用のパスワードが一致しません。');
            return;
        }

        setBusy(true);
        try {
            const customer = await api<CustomerProfile>('/customers/register', {
                method: 'POST',
                body: JSON.stringify(profile)
            });
            navigate('/login', { replace: true, state: { returnTo, registeredEmail: customer.email } });
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    if (checking) return <p className="utility-page" role="status">ログイン状態を確認しています…</p>;
    if (session) return <Navigate to={returnTo} replace />;

    return (
        <section className="utility-page login-page">
            <h1>新規会員登録</h1>
            <form className="form" onSubmit={register}>
                <fieldset className="stack account-fields" disabled={busy}>
                    <legend className="sr-only">会員情報</legend>
                    <ProfileFields />
                    <label>
                        パスワード（8文字以上）
                        <input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                    </label>
                    <label>
                        パスワードの確認
                        <input type="password" name="passwordConfirmation" autoComplete="new-password" minLength={8} maxLength={128} required />
                    </label>
                    {error && <p role="alert">{error}</p>}
                    <button type="submit">{busy ? '登録中…' : '会員登録する'}</button>
                </fieldset>
            </form>
            <p className="account-form-link"><Link to="/login" state={{ returnTo }}>すでに会員の方はログイン</Link></p>
        </section>
    );
}
