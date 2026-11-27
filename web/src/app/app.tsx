import { Grid2X2, LogOut, ShoppingBag, UserRound } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useMatch } from 'react-router-dom';
import { useSession } from '@thread/shared/session';
import { Cart } from '../features/cart/cart';
import { useCart } from '../features/cart/cart-state';
import { CheckoutAddress } from '../features/checkout/checkout-address-page';
import { CheckoutConfirm } from '../features/checkout/checkout-confirm-page';
import { CheckoutComplete } from '../features/checkout/checkout-complete-page';
import { CheckoutFlow, GuestCheckoutFlow } from '../features/checkout/checkout-flow';
import { Register } from '../features/auth/register';
import { AccountPage } from '../features/account/account-page';
import { Login } from '../features/auth/login';
import { Orders } from '../features/orders/orders';
import { Products } from '../features/products/product-list-page';
import { ProductDetail } from '../features/products/product-detail-page';

/** ストアの共通ヘッダー・カート表示・画面ルートを構成する */
export function Shop() {
    const { session, logout } = useSession();
    const { items } = useCart();
    const cartQuantity = items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const cartIcon = useRef<HTMLSpanElement>(null);
    const header = useRef<HTMLElement>(null);
    const homePage = useMatch('/');
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);

    useLayoutEffect(() => {
        const element = header.current;
        if (!element) return;
        const rootStyle = document.documentElement.style;
        // 固定ヘッダーの高さを測って CSS の表示位置に反映する
        const measureHeader = () => rootStyle.setProperty('--store-header-height', `${element.offsetHeight}px`);
        measureHeader();
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measureHeader);
        observer?.observe(element);

        // スクロール量に応じて重なり表示のヘッダーを切り替える
        const updateScroll = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', updateScroll, { passive: true });
        return () => {
            observer?.disconnect();
            window.removeEventListener('scroll', updateScroll);
            rootStyle.removeProperty('--store-header-height');
        };
    }, []);

    return (
        <>
            <header
                ref={header}
                className={homePage ? 'header header--home' : 'header'}
                data-scrolled={scrolled || undefined}
            >
                <div className="header-inner">
                    <Link to="/" className="wordmark" aria-label="THREAD ホーム">
                        THREAD.
                    </Link>
                    <nav className="account-nav" aria-label="アカウント">
                        <Link to="/#collection" aria-label="商品一覧">
                            <Grid2X2 aria-hidden="true" />
                            <span>商品一覧</span>
                        </Link>
                        {session ? (
                            <>
                                <NavLink to="/account" aria-label="マイページ">
                                    <UserRound aria-hidden="true" />
                                    <span>マイページ</span>
                                </NavLink>
                                <button onClick={logout} aria-label="ログアウト">
                                    <LogOut aria-hidden="true" />
                                    <span>ログアウト</span>
                                </button>
                            </>
                        ) : (
                            <NavLink to="/login" aria-label="ログイン">
                                <UserRound aria-hidden="true" />
                                <span>ログイン</span>
                            </NavLink>
                        )}
                        <NavLink to="/cart" aria-label={cartQuantity > 0 ? `カート（${cartQuantity}点）` : 'カート'}>
                            <span ref={cartIcon} className="header-cart-icon" aria-hidden="true">
                                <ShoppingBag />
                                {cartQuantity > 0 && <span className="header-cart-quantity">+{cartQuantity}</span>}
                            </span>
                            <span>カート</span>
                        </NavLink>
                    </nav>
                </div>
            </header>
            <main className={homePage ? 'store-home' : undefined}>
                <Routes>
                    <Route index element={<Products />} />
                    <Route path="/products/:id" element={<ProductDetail cartIcon={cartIcon} />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/checkout/guest" element={<GuestCheckoutFlow />}>
                        <Route index element={<CheckoutAddress />} />
                        <Route path="confirm" element={<CheckoutConfirm />} />
                        <Route path="complete/:id" element={<CheckoutComplete />} />
                    </Route>
                    <Route path="/checkout" element={<CheckoutFlow />}>
                        <Route index element={<CheckoutAddress />} />
                        <Route path="confirm" element={<CheckoutConfirm />} />
                        <Route path="complete/:id" element={<CheckoutComplete />} />
                    </Route>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route
                        path="*"
                        element={
                            <p>
                                ページが見つかりません。 <Link to="/">商品一覧へ</Link>
                            </p>
                        }
                    />
                </Routes>
            </main>
            <footer>
                <div>
                    <Link to="/" className="wordmark" aria-label="THREAD ホーム">
                        THREAD.
                    </Link>
                    <span>演習用アパレルストア</span>
                </div>
            </footer>
        </>
    );
}
