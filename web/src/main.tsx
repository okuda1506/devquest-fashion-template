import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { Cart } from './features/cart/cart';
import { Login } from './features/auth/login';
import { SessionProvider, useSession } from './features/auth/session';
import { Admin } from './features/admin/admin';
import { Orders } from './features/orders/orders';
import { ProductDetail, Products } from './features/products/products';
import './styles.css';

function Shop() {
  const { session, logout } = useSession();
  return <>
    <header className="header"><Link to="/" className="wordmark">THREAD.</Link><nav aria-label="ストア">
      <NavLink to="/" end>商品一覧</NavLink><NavLink to="/cart">カート</NavLink><NavLink to="/orders">注文履歴</NavLink>
      {session?.role === 'ADMIN' && <NavLink to="/admin">店舗管理</NavLink>}
      {session ? <button onClick={logout}>ログアウト</button> : <NavLink to="/login">ログイン</NavLink>}
    </nav></header>
    <main><Routes>
      <Route index element={<Products />} /><Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} /><Route path="/orders" element={<Orders />} />
      <Route path="/login" element={<Login />} /><Route path="/admin" element={<Admin />} />
      <Route path="*" element={<p>ページが見つかりません。 <Link to="/">商品一覧へ</Link></p>} />
    </Routes></main>
    <footer>THREAD. <span>演習用アパレルストア</span></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><SessionProvider><Shop /></SessionProvider></HashRouter>);
