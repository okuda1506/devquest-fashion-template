import { ClipboardList, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useMatch } from 'react-router-dom';
import { Cart } from './features/cart/cart';
import { CartProvider, useCart } from './features/cart/cart-state';
import { CheckoutAddress, CheckoutComplete, CheckoutConfirm, CheckoutFlow } from './features/checkout/checkout';
import { Login } from './features/auth/login';
import { SessionProvider, useSession } from './features/auth/session';
import { Orders } from './features/orders/orders';
import { ProductDetail, Products } from './features/products/products';
import './styles.css';

function Shop() {
  const { session, logout } = useSession();
  const { items } = useCart();
  const cartQuantity = items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const cartIcon = useRef<HTMLSpanElement>(null);
  const homePage = useMatch('/');
  const detailPage = useMatch('/products/:id');
  return <>
    <header className={detailPage ? 'header header--sticky' : 'header'}><div className="header-inner">
      <Link to="/" className="wordmark" aria-label="THREAD ホーム">THREAD.</Link>
      <nav className="store-nav" aria-label="ストア">
        <NavLink to="/" end>商品一覧</NavLink>
      </nav>
      <nav className="account-nav" aria-label="アカウント">
        <NavLink to="/orders" aria-label="注文履歴"><ClipboardList aria-hidden="true" /><span>注文履歴</span></NavLink>
        {session ? <button onClick={logout} aria-label="ログアウト"><LogOut aria-hidden="true" /><span>ログアウト</span></button>
          : <NavLink to="/login" aria-label="ログイン"><UserRound aria-hidden="true" /><span>ログイン</span></NavLink>}
        <NavLink to="/cart" aria-label={cartQuantity > 0 ? `カート（${cartQuantity}点）` : 'カート'}>
          <span ref={cartIcon} className="header-cart-icon" aria-hidden="true">
            <ShoppingBag />
            {cartQuantity > 0 && <span className="header-cart-quantity">+{cartQuantity}</span>}
          </span>
          <span>カート</span>
        </NavLink>
      </nav>
    </div></header>
    <main className={homePage ? 'store-home' : undefined}><Routes>
      <Route index element={<Products />} /><Route path="/products/:id" element={<ProductDetail cartIcon={cartIcon} />} />
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
createRoot(document.getElementById('root')!).render(
  <HashRouter><SessionProvider app="store"><CartProvider><Shop /></CartProvider></SessionProvider></HashRouter>,
);
