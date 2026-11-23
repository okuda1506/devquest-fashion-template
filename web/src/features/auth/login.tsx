import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from './session';

export function Login() {
  const navigate = useNavigate();
  const returnTo = useLocation().state?.returnTo;
  const destination = returnTo === '/checkout' || returnTo === '/cart' ? returnTo : '/';
  const { login, notice } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <section className="utility-page login-page"><h1>お客様ログイン</h1>
    {notice && <p role="status">{notice}</p>}
    <form className="stack form" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      setError(''); setBusy(true);
      try { await login(String(data.get('email')), String(data.get('password'))); navigate(destination, { replace: true }); }
      catch (error) { setError((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <label>メールアドレス <input type="email" name="email" autoComplete="username" required /></label>
      <label>パスワード <input type="password" name="password" autoComplete="current-password" required /></label>
      <button disabled={busy}>{busy ? '接続中…' : 'ログイン'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    <p className="demo-account">演習用アカウント<br /><code>customer@example.test</code> ／ <code>thread-customer</code></p>
  </section>;
}
