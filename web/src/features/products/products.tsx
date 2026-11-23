import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';

export type Product = { id: string; name: string; category: string; description: string; price: number; stock: number; isPublished: boolean };
export const categories: Record<string, string> = { tops: 'トップス', outerwear: 'アウター', bottoms: 'ボトムス', accessories: '小物' };
export type Sort = 'default' | 'asc' | 'desc';

export function sortProducts(products: Product[], sort: Sort) {
  if (sort === 'default') return products;
  return [...products].sort((a, b) => sort === 'asc'
    ? String(a.price).localeCompare(String(b.price))
    : String(b.price).localeCompare(String(a.price)));
}

export function ProductCard({ product }: { product: Product }) {
  return <article className="product-card">
    <Link to={'/products/' + product.id}>
      <ProductVisual product={product} />
      <span className="eyebrow">{categories[product.category]}</span>
      <h2>{product.name}</h2>
      <p>{yen(product.price)}</p>
    </Link>
  </article>;
}

function ProductVisual({ product }: { product: Product }) {
  return <div className={'product-visual ' + product.category} aria-hidden="true"><span>THREAD</span></div>;
}

export function Products() {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('default');
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    setState('loading');
    api<{ items: Product[] }>('/products?' + params, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) { setProducts(data.items); setState('ready'); } },
      () => { if (!controller.signal.aborted) setState('error'); },
    );
    return () => controller.abort();
  }, [query, attempt]);

  return <>
    <section className="shop-hero"><span className="eyebrow">THREAD / 定番コレクション</span><h1>日々をつくる服。</h1><p>繰り返し着たくなる、素材とシルエット。</p></section>
    <section aria-labelledby="collection"><h2 id="collection">商品一覧</h2>
      <div className="filters">
        <label>カテゴリー <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">すべて</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>商品名 <input value={query} onChange={e => setQuery(e.target.value)} placeholder="商品を検索" /></label>
        <label>並び順 <select value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="default">標準</option><option value="asc">価格が安い順</option><option value="desc">価格が高い順</option>
        </select></label>
      </div>
      {state === 'loading' && <p role="status">商品を読み込み中…</p>}
      {state === 'error' && <p role="alert">商品を取得できませんでした。 <button onClick={() => setAttempt(n => n + 1)}>再試行</button></p>}
      {state === 'ready' && (products.length ? <div className="products">{sortProducts(products, sort).map(product => <ProductCard key={product.id} product={product} />)}</div> : <p>該当する商品はありません。</p>)}
    </section>
  </>;
}

export function ProductDetail() {
  const { id } = useParams();
  const { session } = useSession();
  const [result, setResult] = useState<{ id?: string; item?: Product; error?: string }>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Product>('/products/' + encodeURIComponent(id ?? ''), { signal: controller.signal }).then(
      item => { if (!controller.signal.aborted) setResult({ id, item }); },
      (error: Error) => { if (!controller.signal.aborted) setResult({ id, error: error.message }); },
    );
    return () => controller.abort();
  }, [id]);
  if (result.id !== id) return <p role="status">商品を読み込み中…</p>;
  if (!result.item) return <p role="alert">{result.error}</p>;
  const product = result.item;
  return <div className="detail"><ProductVisual product={product} /><section>
    <Link to="/">商品一覧へ</Link><h1>{product.name}</h1><p>{product.description}</p><strong>{yen(product.price)}</strong>
    <p>{product.stock > 0 ? `在庫 ${product.stock} 点` : '在庫切れ'}</p>
    {session ? <button type="button" disabled={!product.stock || busy} onClick={async () => {
      setBusy(true);
      try {
        await api('/cart/' + product.id, { method: 'PUT', body: '{"quantity":1}' }, session.token);
        setMessage('カートに追加しました。');
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>カートに追加</button> : <Link to="/login">ログインして購入</Link>}
    <p role="status">{message}</p>
  </section></div>;
}
