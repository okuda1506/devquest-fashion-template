import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '../../api';

type Session = { token: string; name: string; role: 'CUSTOMER' | 'ADMIN' };
type SessionContext = { session: Session | null; login: (email: string, password: string) => Promise<void>; logout: () => void };
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('thread-session') ?? 'null'); } catch { return null; }
  });
  return <Context.Provider value={{
    session,
    login: async (email, password) => {
      const next = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      sessionStorage.setItem('thread-session', JSON.stringify(next));
      setSession(next);
    },
    logout: () => { sessionStorage.removeItem('thread-session'); setSession(null); },
  }}>{children}</Context.Provider>;
}

export function useSession() { return useContext(Context)!; }
