import { Boxes, ClipboardList, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useSession } from '@thread/shared/session';
import { Dashboard } from './dashboard';
import { Login } from './login';
import { ManageOrders } from './manage-orders';
import { ManageProducts } from './manage-products';

const sections = [
  { path: '/', label: 'ダッシュボード', Icon: LayoutDashboard },
  { path: '/products', label: '商品管理', Icon: Package },
  { path: '/inventory', label: '在庫管理', Icon: Boxes },
  { path: '/orders', label: '受注管理', Icon: ClipboardList },
] as const;

function ManagementLayout() {
  const { session, checking, logout } = useSession();
  if (checking) return <p className="session-check" role="status">セッションを確認中…</p>;
  if (!session) return <Navigate to="/login" replace />;

  return <div className="admin-layout">
    <a className="skip-link" href="#main" onClick={event => {
      event.preventDefault();
      document.getElementById('main')?.focus();
    }}>本文に移動</a>
    <aside className="sidebar">
      <Link to="/" className="admin-brand"><span className="brand-mark" aria-hidden="true">T</span><strong>THREAD</strong><small>店舗管理</small></Link>
      <nav aria-label="店舗管理">
        {sections.map(({ path, label, Icon }) => <NavLink key={path} to={path} end>
          <Icon size={17} aria-hidden="true" /> {label}
        </NavLink>)}
      </nav>
      <div className="sidebar-account">
        <span>{session.name}</span>
        <button className="admin-secondary" onClick={logout}><LogOut size={16} aria-hidden="true" /> ログアウト</button>
      </div>
    </aside>
    <main className="admin-content" id="main" tabIndex={-1}><Outlet context={session.token} /></main>
  </div>;
}

export function Admin() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ManagementLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="/products" element={<ManageProducts key="products" inventory={false} />} />
      <Route path="/inventory" element={<ManageProducts key="inventory" inventory />} />
      <Route path="/orders" element={<ManageOrders />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>;
}
