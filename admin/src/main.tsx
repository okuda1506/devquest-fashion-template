import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from '@thread/shared/session';
import { Admin } from './features/admin/admin';
import './styles.css';

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <SessionProvider app="admin">
            <Admin />
        </SessionProvider>
    </HashRouter>
);
