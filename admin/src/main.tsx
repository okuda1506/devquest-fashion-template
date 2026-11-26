import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from '@thread/shared/session';
import { Admin } from './app/app';
import './styles/admin.css';

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <SessionProvider app="admin">
            <Admin />
        </SessionProvider>
    </HashRouter>
);
