import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, rejectedSessions } from './index';

const roles = { store: 'CUSTOMER', admin: 'ADMIN' } as const;
type App = keyof typeof roles;
type Session = { token: string; name: string; role: typeof roles[App]; expiresAt: number };
type State = {
  session: Session | null;
  checking: boolean;
  notice: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
const Context = createContext<State | null>(null);

function isSession(value: unknown, app: App): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session>;
  return candidate.role === roles[app] && typeof candidate.name === 'string' &&
    typeof candidate.token === 'string' && typeof candidate.expiresAt === 'number' && candidate.expiresAt > Date.now();
}

function readSession(key: string, app: App) {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (isSession(value, app)) return value;
    sessionStorage.removeItem(key);
  } catch { /* ストレージが使えない場合は現在の画面だけで状態を管理する。 */ }
  return null;
}

export function SessionProvider({ app, children }: { app: App; children: ReactNode }) {
  const storageKey = 'thread-' + app + '-session';
  const [session, setSession] = useState(() => readSession(storageKey, app));
  const [checking, setChecking] = useState(!!session);
  const [notice, setNotice] = useState('');
  const active = useRef(session);

  const clear = useCallback((message = '') => {
    active.current = null;
    setSession(null);
    setChecking(false);
    setNotice(message);
    try { sessionStorage.removeItem(storageKey); } catch { /* 画面上のセッションは破棄済み。 */ }
  }, [storageKey]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const reauthenticate = 'セッションを確認できません。もう一度ログインしてください。';
    const reject = (event: Event) => {
      if ((event as CustomEvent<string>).detail === active.current?.token) clear(reauthenticate);
    };
    const timer = window.setTimeout(() => clear(reauthenticate), Math.max(0, session.expiresAt - Date.now()));
    rejectedSessions.addEventListener('rejected', reject);
    void api('/auth/' + app + '/session', { signal: controller.signal }, session.token).then(
      () => { if (!controller.signal.aborted && active.current?.token === session.token) setChecking(false); },
      () => { if (!controller.signal.aborted && active.current?.token === session.token) clear(reauthenticate); },
    );
    return () => {
      window.clearTimeout(timer);
      rejectedSessions.removeEventListener('rejected', reject);
      controller.abort();
    };
  }, [app, clear, session]);

  async function login(email: string, password: string) {
    const next = await api<Session>('/auth/' + app + '/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!isSession(next, app)) throw new Error('ログインできませんでした。');
    active.current = next;
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 現在の画面でログインを継続する。 */ }
    setChecking(true);
    setNotice('');
    setSession(next);
  }

  return <Context.Provider value={{ session: checking ? null : session, checking, notice, login, logout: () => clear() }}>{children}</Context.Provider>;
}

export function useSession() { return useContext(Context)!; }
