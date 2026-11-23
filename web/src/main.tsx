import { ClipboardList, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { Cart } from './features/cart/cart';
import { CheckoutAddress, CheckoutComplete, CheckoutConfirm, CheckoutFlow } from './features/checkout/checkout';
import { Login } from './features/auth/login';
import { SessionProvider, useSession } from './features/auth/session';
import { Orders } from './features/orders/orders';
import { ProductDetail, Products } from './features/products/products';
import './styles.css';

function Shop() {
  const { session, logout } = useSession();
  return <>
    <header className="header"><div className="header-inner">
      <Link to="/" className="wordmark" aria-label="THREAD ホーム">THREAD.</Link>
      <nav className="store-nav" aria-label="ストア">
        <NavLink to="/" end>商品一覧</NavLink>
      </nav>
      <nav className="account-nav" aria-label="アカウント">
        <NavLink to="/orders" aria-label="注文履歴"><ClipboardList aria-hidden="true" /><span>注文履歴</span></NavLink>
        {session ? <button onClick={logout} aria-label="ログアウト"><LogOut aria-hidden="true" /><span>ログアウト</span></button>
          : <NavLink to="/login" aria-label="ログイン"><UserRound aria-hidden="true" /><span>ログイン</span></NavLink>}
        <NavLink to="/cart" aria-label="カート"><ShoppingBag aria-hidden="true" /><span>カート</span></NavLink>
      </nav>
    </div></header>
    <main><Routes>
      <Route index element={<Products />} /><Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} /><Route path="/orders" element={<Orders />} />
      <Route path="/checkout" element={<CheckoutFlow />}>
        <Route index element={<CheckoutAddress />} />
        <Route path="confirm" element={<CheckoutConfirm />} />
        <Route path="complete/:id" element={<CheckoutComplete />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<p>ページが見つかりません。 <Link to="/">商品一覧へ</Link></p>} />
    </Routes></main>
    <footer><div><Link to="/" className="wordmark" aria-label="THREAD ホーム">THREAD.</Link><span>演習用アパレルストア</span></div></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><SessionProvider app="store"><Shop /></SessionProvider></HashRouter>);
