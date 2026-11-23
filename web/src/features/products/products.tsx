import { categories, type Product } from '@thread/shared';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, Minus, Plus, Search, ShoppingBag } from 'lucide-react';
import campaignImage from '../../assets/campaign.webp';
import campaignPortrait from '../../assets/campaign-portrait.webp';
import { ProductVisual } from './product-visual';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';
import { animateCartAddition } from '../cart/cart-animation';
import { useCart } from '../cart/cart-state';

export type { Product } from '@thread/shared';
export type Sort = 'default' | 'asc' | 'desc';

/** 画面で指定された価格順で商品一覧を並べ替える */
export function sortProducts(products: Product[], sort: Sort) {
    if (sort === 'default') return products;
    return [...products].sort((a, b) =>
        sort === 'asc' ? String(a.price).localeCompare(String(b.price)) : String(b.price).localeCompare(String(a.price))
    );
}

/** 一覧で商品写真・商品名・価格を表示して詳細へ案内する */
export function ProductCard({ product }: { product: Product }) {
    return (
        <article className="product-card">
            <Link to={'/products/' + product.id}>
                <ProductVisual product={product} />
                <div className="product-caption">
                    <span className="product-category">{categories[product.category]}</span>
                    <h2>{product.name}</h2>
                    <p>{yen(product.price)}</p>
                </div>
            </Link>
        </article>
    );
}

/** ストアのトップビジュアルと商品検索結果を表示する */
export function Products() {
    const [campaignLoaded, setCampaignLoaded] = useState(false);
    const [category, setCategory] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('default');
    const [products, setProducts] = useState<Product[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const productGrid = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (query.trim()) params.set('q', query.trim());
        setState('loading');
        api<{ items: Product[] }>('/products?' + params, { signal: controller.signal }).then(
            (data) => {
                if (!controller.signal.aborted) {
                    setProducts(data.items);
                    setState('ready');
                }
            },
            () => {
                if (!controller.signal.aborted) setState('error');
            }
        );
        return () => controller.abort();
    }, [query, attempt]);

    useLayoutEffect(() => {
        if (
            !productGrid.current ||
            typeof IntersectionObserver === 'undefined' ||
            !window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches
        )
            return;

        const cards = Array.from(productGrid.current.querySelectorAll<HTMLElement>('.product-card')).filter(
            (card) => card.getBoundingClientRect().top >= window.innerHeight
        );
        const observer = new IntersectionObserver(
            (entries) => {
                entries
                    .filter((entry) => entry.isIntersecting)
                    .forEach(({ target }, index) => {
                        const card = target as HTMLElement;
                        card.style.setProperty('--reveal-delay', `${Math.min(index, 2) * 65}ms`);
                        card.dataset.reveal = 'shown';
                        observer.unobserve(card);
                    });
            },
            { threshold: 0.1 }
        );

        cards.forEach((card) => {
            card.dataset.reveal = 'pending';
            observer.observe(card);
        });
        return () => {
            observer.disconnect();
            cards.forEach((card) => {
                delete card.dataset.reveal;
                card.style.removeProperty('--reveal-delay');
            });
        };
    }, [products, state]);

    return (
        <>
            <section className="shop-hero" aria-labelledby="campaign-title">
                <div className="hero-copy">
                    <p className="campaign-label">THREAD 定番コレクション</p>
                    <h1 id="campaign-title" lang="en">
                        <span>Daily</span> <br />
                        <span>Uniform.</span>
                    </h1>
                    <p className="campaign-description">繰り返し着たくなる、素材とシルエット。</p>
                    <button
                        className="collection-jump"
                        onClick={() => {
                            const heading = document.getElementById('collection');
                            const smooth = window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
                            heading?.focus({ preventScroll: true });
                            heading?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
                        }}
                    >
                        商品を見る <ArrowDownRight size={17} aria-hidden="true" />
                    </button>
                </div>
                <picture className="campaign-frame">
                    <source media="(max-aspect-ratio: 4/5)" srcSet={campaignPortrait} width={941} height={1672} />
                    <img
                        className="campaign-photo"
                        src={campaignImage}
                        width={1536}
                        height={1024}
                        fetchPriority="high"
                        data-loaded={campaignLoaded || undefined}
                        onLoad={() => setCampaignLoaded(true)}
                        alt="コンクリートの建物を背景に、ジャケットとワイドパンツを着こなす女性と男性のモデル"
                    />
                </picture>
            </section>
            <section className="catalog" aria-labelledby="collection">
                <div className="catalog-toolbar">
                    <div className="catalog-heading">
                        <h2 id="collection" tabIndex={-1}>
                            商品一覧
                        </h2>
                        {state === 'ready' && <span>{products.length} 点</span>}
                    </div>
                    <div className="filters">
                        <label className="catalog-search">
                            <Search size={15} aria-hidden="true" />
                            <span className="sr-only">商品名</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="商品を検索"
                            />
                        </label>
                        <label>
                            カテゴリー{' '}
                            <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="">すべて</option>
                                {Object.entries(categories).map(([key, name]) => (
                                    <option key={key} value={key}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            並び順{' '}
                            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                                <option value="default">標準</option>
                                <option value="asc">価格が安い順</option>
                                <option value="desc">価格が高い順</option>
                            </select>
                        </label>
                    </div>
                </div>
                {state === 'loading' && <p role="status">商品を読み込み中…</p>}
                {state === 'error' && (
                    <p role="alert">
                        商品を取得できませんでした。 <button onClick={() => setAttempt((n) => n + 1)}>再試行</button>
                    </p>
                )}
                {state === 'ready' &&
                    (products.length ? (
                        <div className="products" ref={productGrid}>
                            {sortProducts(products, sort).map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    ) : (
                        <p>該当する商品はありません。</p>
                    ))}
            </section>
        </>
    );
}

/** 商品情報と購入数量を選べるカート追加欄を表示する */
export function ProductDetail({ cartIcon }: { cartIcon: RefObject<HTMLSpanElement | null> }) {
    const { id } = useParams();
    const { session } = useSession();
    const productImage = useRef<HTMLImageElement>(null);
    const [result, setResult] = useState<{ id?: string; item?: Product; error?: string }>({});
    useEffect(() => {
        const controller = new AbortController();
        api<Product>('/products/' + encodeURIComponent(id ?? ''), { signal: controller.signal }).then(
            (item) => {
                if (!controller.signal.aborted) setResult({ id, item });
            },
            (error: Error) => {
                if (!controller.signal.aborted) setResult({ id, error: error.message });
            }
        );
        return () => controller.abort();
    }, [id]);
    if (result.id !== id) return <p role="status">商品を読み込み中…</p>;
    if (!result.item) return <p role="alert">{result.error}</p>;
    const product = result.item;
    return (
        <div className="product-page">
            <Link className="back-link" to="/">
                <ArrowLeft size={15} aria-hidden="true" /> 商品一覧へ
            </Link>
            <div className="detail">
                <ProductVisual product={product} detail imageRef={productImage} />
                <section className="detail-copy">
                    <span className="product-category">{categories[product.category]}</span>
                    <h1>{product.name}</h1>
                    <strong className="detail-price">{yen(product.price)}</strong>
                    <p className="detail-description">{product.description}</p>
                    <p>{product.stock > 0 ? `在庫 ${product.stock} 点` : '在庫切れ'}</p>
                    {session ? (
                        <AddToCart
                            key={product.id + ':' + session.token}
                            product={product}
                            token={session.token}
                            cartIcon={cartIcon}
                            productImage={productImage}
                        />
                    ) : (
                        <Link className="action-link detail-add" to="/login">
                            <ShoppingBag size={18} aria-hidden="true" /> ログインして購入{' '}
                            <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                    )}
                </section>
            </div>
        </div>
    );
}

/** 商品詳細で選択した数量を追加して結果を表示する */
function AddToCart({
    product,
    token,
    cartIcon,
    productImage
}: {
    product: Product;
    token: string;
    cartIcon: RefObject<HTMLSpanElement | null>;
    productImage: RefObject<HTMLImageElement | null>;
}) {
    const { items, refresh } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const stopAnimation = useRef<(() => void) | undefined>(undefined);
    const inCart = items?.find((item) => item.productId === product.id)?.quantity ?? 0;
    const available = Math.max(0, Math.min(product.stock, 99) - inCart);
    const selected = Math.min(quantity, available);

    useEffect(() => () => stopAnimation.current?.(), []);

    /** 商品数量を追加し成功時にカート状態と演出を反映する */
    async function addToCart(button: HTMLButtonElement) {
        stopAnimation.current?.();
        setAdded(false);
        setError('');
        setBusy(true);
        try {
            await api(
                '/cart/' + encodeURIComponent(product.id),
                { method: 'POST', body: JSON.stringify({ quantity: selected }) },
                token
            );
            refresh();
            setAdded(true);
        } catch (cause) {
            setError((cause as Error).message);
            return;
        } finally {
            setBusy(false);
        }
        if (cartIcon.current && button.isConnected) {
            stopAnimation.current = animateCartAddition(cartIcon.current, productImage.current, button);
        }
    }

    return (
        <div className="detail-actions">
            <div className="detail-quantity-label">
                <span>追加点数</span>
                {inCart > 0 && <span>カート内 {inCart} 点</span>}
            </div>
            <div className="detail-purchase-row">
                <div className="detail-quantity" role="group" aria-label="追加点数">
                    <button
                        type="button"
                        aria-label="追加点数を減らす"
                        disabled={busy || selected <= 1}
                        onClick={() => setQuantity(selected - 1)}
                    >
                        <Minus size={15} aria-hidden="true" />
                    </button>
                    <output>{selected}</output>
                    <button
                        type="button"
                        aria-label="追加点数を増やす"
                        disabled={busy || selected >= available}
                        onClick={() => setQuantity(selected + 1)}
                    >
                        <Plus size={15} aria-hidden="true" />
                    </button>
                </div>
                <button
                    type="button"
                    className="detail-add"
                    disabled={busy || selected === 0}
                    onClick={(event) => void addToCart(event.currentTarget)}
                >
                    <ShoppingBag size={18} aria-hidden="true" />
                    {busy ? '追加中…' : 'カートに追加'}
                </button>
            </div>
            {product.stock > 0 && available === 0 && (
                <p className="detail-quantity-note">追加できる上限に達しました。</p>
            )}
            <div className={added ? 'detail-cart-feedback is-added' : 'detail-cart-feedback'}>
                <p role="status">
                    {added && (
                        <>
                            <span className="detail-cart-check">
                                <Check size={14} aria-hidden="true" />
                            </span>
                            カートに追加しました。
                        </>
                    )}
                </p>
                {added && (
                    <Link className="detail-cart-link" to="/cart">
                        カートを見る <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                )}
            </div>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
