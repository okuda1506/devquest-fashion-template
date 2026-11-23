import { Boxes, ClipboardList, Package } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/session';
import { ManageOrders } from './manage-orders';
import { ManageProducts } from './manage-products';
import './admin.css';

const sections = [
  { id: 'products', label: '商品', Icon: Package },
  { id: 'inventory', label: '在庫', Icon: Boxes },
  { id: 'orders', label: '受注', Icon: ClipboardList },
] as const;

export function Admin() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const view = params.get('view');
  const active = sections.find(section => section.id === view)?.id ?? 'products';

  return <section className="utility-page admin-page">
    <h1>店舗管理</h1>
    {session?.role !== 'ADMIN'
      ? <p>{session ? '店舗管理には管理者権限が必要です。' : <><Link to="/login">管理者としてログイン</Link>してください。</>}</p>
      : <>
        <nav className="admin-tabs" aria-label="店舗管理">
          {sections.map(({ id, label, Icon }) => <Link key={id}
            to={id === 'products' ? '/admin' : '/admin?view=' + id}
            aria-current={id === active ? 'page' : undefined}>
            <Icon size={17} aria-hidden="true" /> {label}
          </Link>)}
        </nav>
        {active === 'orders' ? <ManageOrders token={session.token} />
          : <ManageProducts key={active} token={session.token} inventory={active === 'inventory'} />}
      </>}
  </section>;
}
