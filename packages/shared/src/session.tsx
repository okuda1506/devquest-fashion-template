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
    typeof candidate.token === 'string' && typeof candidate.expiresAt === 'number' &&
    Number.isFinite(candidate.expiresAt) && candidate.expiresAt > Date.now();
}

function readSession(key: string, app: App) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (isSession(value, app)) return value;
    localStorage.removeItem(key);
  } catch { /* ストレージが使えない場合は現在の画面だけで状態を管理する。 */ }
  return null;
}

export function SessionProvider({ app, children }: { app: App; children: ReactNode }) {
  const storageKey = 'thread-' + app + '-session';
  const [session, setSession] = useState(() => readSession(storageKey, app));
  const [checking, setChecking] = useState(!!session);
  const [notice, setNotice] = useState('');
  const active = useRef(session);

  const applySession = useCallback((next: Session | null, message = '') => {
    active.current = next;
    setSession(next);
    setChecking(!!next);
    setNotice(message);
  }, []);

  const clear = useCallback((message = '', expectedToken?: string) => {
    if (expectedToken && active.current?.token !== expectedToken) return;
    if (expectedToken) {
      const saved = readSession(storageKey, app);
      if (saved && saved.token !== expectedToken) {
        applySession(saved);
        return;
      }
    }
    applySession(null, message);
    try { localStorage.removeItem(storageKey); } catch { /* 画面上のセッションは破棄済み。 */ }
  }, [app, storageKey, applySession]);

  useEffect(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* 旧版のタブ専用セッションは使わない。 */ }
    function syncSession(event: StorageEvent) {
      if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return;
      const next = readSession(storageKey, app);
      if (next?.token !== active.current?.token) applySession(next);
    }
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, [app, storageKey, applySession]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const reauthenticate = 'セッションを確認できません。もう一度ログインしてください。';
    const reject = (event: Event) => {
      clear(reauthenticate, (event as CustomEvent<string>).detail);
    };
    const expire = () => clear(reauthenticate, session.token);
    const checkExpiry = () => { if (Date.now() >= session.expiresAt) expire(); };
    const timer = window.setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    window.addEventListener('focus', checkExpiry);
    rejectedSessions.addEventListener('rejected', reject);
    void api('/auth/' + app + '/session', { signal: controller.signal }, session.token).then(
      () => { if (!controller.signal.aborted && active.current?.token === session.token) setChecking(false); },
      () => { if (!controller.signal.aborted) clear(reauthenticate, session.token); },
    );
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', checkExpiry);
      rejectedSessions.removeEventListener('rejected', reject);
      controller.abort();
    };
  }, [app, clear, session]);

  async function login(email: string, password: string) {
    const next = await api<Session>('/auth/' + app + '/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!isSession(next, app)) throw new Error('ログインできませんでした。');
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 現在の画面でログインを継続する。 */ }
    applySession(next);
  }

  return <Context.Provider value={{ session: checking ? null : session, checking, notice, login, logout: () => clear() }}>{children}</Context.Provider>;
}

export function useSession() { return useContext(Context)!; }
