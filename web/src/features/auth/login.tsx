import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@thread/shared/session';
import { loginDestination } from './login-destination';

/** 画面用途に対応するログインフォームを表示して認証後に対象画面へ移動する */
export function Login() {
    const navigate = useNavigate();
    const state = useLocation().state;
    const destination = loginDestination(state);
    const registeredEmail = typeof state?.registeredEmail === 'string' ? state.registeredEmail : undefined;
    const { login, notice } = useSession();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <section className="utility-page login-page">
            <h1>お客様ログイン</h1>
            {notice && <p role="status">{notice}</p>}
            {registeredEmail && <p role="status">会員登録が完了しました。登録した情報でログインしてください。</p>}
            <form
                className="stack form"
                onSubmit={async (event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    setError('');
                    setBusy(true);
                    try {
                        await login(String(data.get('email')), String(data.get('password')));
                        navigate(destination, { replace: true });
                    } catch (error) {
                        setError((error as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label>
                    メールアドレス <input type="email" name="email" autoComplete="username" defaultValue={registeredEmail} required />
                </label>
                <label>
                    パスワード <input type="password" name="password" autoComplete="current-password" required />
                </label>
                <button disabled={busy}>{busy ? '接続中…' : 'ログイン'}</button>
                {error && <p role="alert">{error}</p>}
            </form>
            <p className="account-form-link">
                <Link to="/register" state={destination === '/' ? undefined : { returnTo: destination }}>新規会員登録</Link>
            </p>
            <p className="demo-account">
                演習用アカウント
                <br />
                <code>customer@example.test</code> ／ <code>thread-customer</code>
            </p>
        </section>
    );
}
