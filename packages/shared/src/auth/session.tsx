import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, rejectedSessions } from '../api/client';

const roles = { store: 'CUSTOMER', admin: 'ADMIN' } as const;
type App = keyof typeof roles;
type Session = { token: string; name: string; role: (typeof roles)[App]; expiresAt: number };
type State = {
    session: Session | null;
    checking: boolean;
    notice: string;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
};
const Context = createContext<State | null>(null);

/** 保存されたセッションが画面のロールと有効期限に合うか検証する */
function isSession(value: unknown, app: App): value is Session {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Session>;
    return (
        candidate.role === roles[app] &&
        typeof candidate.name === 'string' &&
        typeof candidate.token === 'string' &&
        typeof candidate.expiresAt === 'number' &&
        Number.isFinite(candidate.expiresAt) &&
        candidate.expiresAt > Date.now()
    );
}

/**
 * 指定した画面のセッションをブラウザから復元する
 *
 * @param key 画面用途に対応するストレージキー
 * @param app 利用する画面の用途
 * @returns ロールと期限が有効なセッション。読み取れない場合は null
 */
function readSession(key: string, app: App) {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (isSession(value, app)) return value;
        localStorage.removeItem(key);
    } catch {
        /* ストレージを利用できない環境でも画面内の状態管理は継続する */
    }

    return null;
}

/** ログイン状態を画面用途ごとに維持して API とタブ間で同期する */
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

    const clear = useCallback(
        (message = '', expectedToken?: string) => {
            // 古い API 応答やタイマーで再ログイン後のセッションを消さない
            if (expectedToken && active.current?.token !== expectedToken) return;
            if (expectedToken) {
                const saved = readSession(storageKey, app);
                if (saved && saved.token !== expectedToken) {
                    applySession(saved);
                    return;
                }
            }
            applySession(null, message);
            try {
                localStorage.removeItem(storageKey);
            } catch {
                /* 画面内のセッションは破棄済み */
            }
        },
        [app, storageKey, applySession]
    );

    useEffect(() => {
        try {
            sessionStorage.removeItem(storageKey);
        } catch {
            /* 現行セッションと混在しないよう旧版のタブ専用データを除去する */
        }
        // 他タブで発生したセッション変更を現在の画面に反映する
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
        // 401 を返したリクエストのトークンが現在のものと一致する場合にログアウトする
        const reject = (event: Event) => {
            clear(reauthenticate, (event as CustomEvent<string>).detail);
        };
        // 有効期限を迎えたトークンだけを破棄する
        const expire = () => clear(reauthenticate, session.token);
        // タブの復帰時にバックグラウンドで経過した有効期限を確認する
        const checkExpiry = () => {
            if (Date.now() >= session.expiresAt) expire();
        };
        const timer = window.setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
        window.addEventListener('focus', checkExpiry);
        rejectedSessions.addEventListener('rejected', reject);
        void api('/auth/' + app + '/session', { signal: controller.signal }, session.token).then(
            () => {
                if (!controller.signal.aborted && active.current?.token === session.token) setChecking(false);
            },
            () => {
                if (!controller.signal.aborted) clear(reauthenticate, session.token);
            }
        );
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('focus', checkExpiry);
            rejectedSessions.removeEventListener('rejected', reject);
            controller.abort();
        };
    }, [app, clear, session]);

    // 画面用途に対応する認証 API を呼び出してセッションを保存する
    async function login(email: string, password: string) {
        const next = await api<Session>('/auth/' + app + '/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (!isSession(next, app)) throw new Error('ログインできませんでした。');
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            /* ストレージに保存できなくても現在の画面ではログインを継続する */
        }
        applySession(next);
    }

    return (
        <Context.Provider
            value={{ session: checking ? null : session, checking, notice, login, logout: () => clear() }}
        >
            {children}
        </Context.Provider>
    );
}

/** 現在の画面に対応するセッションと操作を取得する */
export function useSession() {
    return useContext(Context)!;
}
