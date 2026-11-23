import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@thread/shared/session';

/** 画面用途に対応するログインフォームを表示して認証後に対象画面へ移動する */
export function Login() {
    const { session, checking, login, notice } = useSession();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    if (session) return <Navigate to="/" replace />;
    if (checking)
        return (
            <p className="session-check" role="status">
                セッションを確認中…
            </p>
        );
    return (
        <main className="admin-login">
            <header className="admin-brand">
                <span className="brand-mark" aria-hidden="true">
                    T
                </span>
                <strong>THREAD</strong>
            </header>
            <h1>管理者ログイン</h1>
            {notice && <p role="status">{notice}</p>}
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    setError('');
                    setBusy(true);
                    try {
                        await login(String(form.get('email')), String(form.get('password')));
                    } catch (cause) {
                        setError((cause as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label>
                    メールアドレス
                    <input type="email" name="email" autoComplete="username" required />
                </label>
                <label>
                    パスワード
                    <input type="password" name="password" autoComplete="current-password" maxLength={128} required />
                </label>
                {error && <p role="alert">{error}</p>}
                <button disabled={busy}>{busy ? '確認中…' : 'ログイン'}</button>
            </form>
        </main>
    );
}
