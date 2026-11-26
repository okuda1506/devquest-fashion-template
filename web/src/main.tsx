import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from '@thread/shared/session';
import { Shop } from './app/app';
import { CartProvider } from './features/cart/cart-state';
import './styles/store.css';

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <SessionProvider app="store">
            <CartProvider>
                <Shop />
            </CartProvider>
        </SessionProvider>
    </HashRouter>
);
