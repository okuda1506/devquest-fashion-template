import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Search } from 'lucide-react';
import campaignImage from '../../assets/campaign.webp';
import { ProductVisual } from './product-visual';
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
      <div className="product-caption">
        <span className="product-category">{categories[product.category]}</span>
        <h2>{product.name}</h2>
        <p>{yen(product.price)}</p>
      </div>
    </Link>
  </article>;
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
    <section className="shop-hero" aria-labelledby="campaign-title">
      <div className="hero-copy">
        <p className="campaign-label">THREAD 定番コレクション</p>
        <h1 id="campaign-title" lang="en">Daily <br />Uniform.</h1>
        <p className="campaign-description">繰り返し着たくなる、素材とシルエット。</p>
        <button className="collection-jump" onClick={() => {
          const heading = document.getElementById('collection');
          heading?.focus({ preventScroll: true });
          heading?.scrollIntoView({ block: 'start' });
        }}>商品を見る <ArrowDownRight size={17} aria-hidden="true" /></button>
      </div>
      <img className="campaign-photo" src={campaignImage} width={1536} height={1024} fetchPriority="high"
        alt="コンクリートの壁を背景に、ジャケットとワイドパンツを着て歩くモデル" />
    </section>
    <section className="catalog" aria-labelledby="collection">
      <div className="catalog-toolbar">
        <div className="catalog-heading"><h2 id="collection" tabIndex={-1}>商品一覧</h2>
          {state === 'ready' && <span>{products.length} 点</span>}
        </div>
        <div className="filters">
          <label className="catalog-search"><Search size={15} aria-hidden="true" /><span className="sr-only">商品名</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="商品を検索" /></label>
          <label>カテゴリー <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">すべて</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
          <label>並び順 <select value={sort} onChange={e => setSort(e.target.value as Sort)}>
            <option value="default">標準</option><option value="asc">価格が安い順</option><option value="desc">価格が高い順</option>
          </select></label>
        </div>
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
  return <div className="product-page">
    <Link className="back-link" to="/"><ArrowLeft size={15} aria-hidden="true" /> 商品一覧へ</Link>
    <div className="detail"><ProductVisual product={product} detail /><section className="detail-copy">
    <span className="product-category">{categories[product.category]}</span>
    <h1>{product.name}</h1><strong className="detail-price">{yen(product.price)}</strong>
    <p className="detail-description">{product.description}</p>
    <p>{product.stock > 0 ? `在庫 ${product.stock} 点` : '在庫切れ'}</p>
    {session ? <button type="button" disabled={!product.stock || busy} onClick={async () => {
      setBusy(true);
      try {
        await api('/cart/' + product.id, { method: 'PUT', body: '{"quantity":1}' }, session.token);
        setMessage('カートに追加しました。');
      } catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>カートに追加</button> : <Link className="action-link" to="/login">ログインして購入 <ArrowUpRight size={17} aria-hidden="true" /></Link>}
    <p role="status">{message}</p>
  </section></div></div>;
}
