import { categories, type Product } from '@thread/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import campaignImage from '../../assets/campaign.webp';
import campaignPortrait from '../../assets/campaign-portrait.webp';
import { api } from '@thread/shared';
import { ProductCard } from './product-card';
import { sortProducts, type Sort } from './product-sort';

/**
 * 固定ヘッダーの下に商品一覧の見出しを表示してフォーカスを移す
 */
function scrollToCollection() {
    const heading = document.getElementById('collection');
    const smooth = window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
}

/** ストアのトップビジュアルと商品検索結果を表示する */
export function Products() {
    const { hash, key } = useLocation();
    const [campaignLoaded, setCampaignLoaded] = useState(false);
    const [category, setCategory] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('default');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [products, setProducts] = useState<Product[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const productGrid = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (hash === '#collection') scrollToCollection();
    }, [hash, key]);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (query.trim()) params.set('q', query.trim());
        if (page > 1) params.set('page', String(page));
        setState('loading');
        api<{ items: Product[]; total: number; limit: number }>('/products?' + params, { signal: controller.signal }).then(
            (data) => {
                if (!controller.signal.aborted) {
                    setProducts(data.items);
                    setTotal(data.total ?? data.items.length);
                    setPageSize(data.limit ?? 20);
                    setState('ready');
                }
            },
            () => {
                if (!controller.signal.aborted) setState('error');
            }
        );
        return () => controller.abort();
    }, [query, attempt, page]);

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
                    <button className="collection-jump" onClick={scrollToCollection}>
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
                        {state === 'ready' && <span>{total} 点</span>}
                    </div>
                    <div className="filters">
                        <label className="catalog-search">
                            <Search size={15} aria-hidden="true" />
                            <span className="sr-only">商品名</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => {
                                    setPage(1);
                                    setQuery(e.target.value);
                                }}
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
                {state === 'ready' && total > pageSize && (
                    <nav className="catalog-pagination" aria-label="商品一覧のページ">
                        <button disabled={page === 1} onClick={() => setPage(page - 1)}>前へ</button>
                        <span>{page} / {Math.ceil(total / pageSize)}</span>
                        <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>次へ</button>
                    </nav>
                )}
            </section>
        </>
    );
}
