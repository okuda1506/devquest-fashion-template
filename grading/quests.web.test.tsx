import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Link, MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Products, ProductCard, ProductDetail } from '../web/src/features/products/products';
import { Cart } from '../web/src/features/cart/cart';
import { CartProvider } from '../web/src/features/cart/cart-state';
import { Orders } from '../web/src/features/orders/orders';
import { CheckoutConfirm, CheckoutFlow } from '../web/src/features/checkout/checkout';
import { ManageOrders } from '../admin/src/features/admin/manage-orders';
import { Dashboard } from '../admin/src/features/admin/dashboard';
import { product } from './fixture';

type Reply = (url: URL, init: RequestInit) => Promise<Response> | Response;
const session = vi.hoisted(() => ({ token: 'shopper-token' }));
vi.mock('../web/src/features/auth/session', () => ({
    useSession: () => ({ session: { token: session.token, name: '購入者', role: 'CUSTOMER' }, checking: false })
}));
const inStock = product('a', 2500, 7);
const soldOut = product('b', 900, 0);
const anotherCategory = { ...product('c', 5200, 3, 'accessories'), name: '別の商品' };
const address = {
    name: '演習 購入者',
    postalCode: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    line1: '1-2',
    line2: '',
    phone: '09012345678'
};
const checkoutId = '390f5850-a3e2-43af-950f-39944ed72f6d';

beforeEach(() => {
    session.token = 'shopper-token';
    sessionStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
});

function criteria(id: number, checks: Record<number, () => unknown>) {
    for (const [condition, check] of Object.entries(checks))
        test(`DEV-${id} criterion-${condition}: 画面の操作と表示`, check);
}

function network(reply: Reply) {
    const mock = vi.fn((input: string, init: RequestInit = {}) =>
        Promise.resolve(reply(new URL(input, location.origin), init))
    );
    vi.stubGlobal('fetch', mock);
    return mock;
}
const response = (value: unknown) => Response.json(value);
const error = (message: string, status = 409) => Response.json({ message }, { status });
const heading = (name: string | RegExp) => screen.findByRole('heading', { name });
const exactButton = (name: string) => screen.findByRole('button', { name });
const search = () => screen.getByRole('searchbox', { name: '商品名' });
const category = () => screen.getByRole('combobox', { name: 'カテゴリー' });

function Location() {
    const route = useLocation();
    return <output aria-label="現在のURL">{route.pathname + route.search}</output>;
}
const url = () => screen.getByLabelText('現在のURL').textContent;
const detail = <ProductDetail cartIcon={{ current: null }} />;
function storefront(path = '/', reply: Reply = () => response({ items: [inStock, soldOut] })) {
    const fetch = network(reply);
    render(
        <MemoryRouter initialEntries={[path]}>
            <CartProvider>
                <Location />
                <Routes>
                    <Route index element={<Products />} />
                    <Route path="products/:id" element={detail} />
                </Routes>
            </CartProvider>
        </MemoryRouter>
    );
    return fetch;
}
function pathCalls(fetch: ReturnType<typeof network>, pathname: string) {
    return fetch.mock.calls
        .map(([input]) => new URL(input, location.origin))
        .filter((url) => url.pathname === pathname);
}

const emptyReply: Reply = (url) =>
    response(url.pathname === '/api/cart' ? [] : { items: url.searchParams.has('q') ? [] : [inStock] });
criteria(113, {
    1: async () => {
        const user = userEvent.setup();
        storefront('/', emptyReply);
        await heading(inStock.name);
        expect(screen.queryByRole('button', { name: '絞り込みを解除' })).toBeNull();
        await user.type(search(), '存在しない');
        expect(await exactButton('絞り込みを解除')).toBeVisible();
    },
    2: async () => {
        const user = userEvent.setup();
        const fetch = storefront('/', emptyReply);
        await user.selectOptions(category(), 'tops');
        await user.type(search(), '存在しない');
        await user.click(await exactButton('絞り込みを解除'));
        expect(search()).toHaveValue('');
        expect(category()).toHaveValue('');
        expect(await heading(inStock.name)).toBeVisible();
        expect(pathCalls(fetch, '/api/products').at(-1)?.search).toBe('');
    },
    3: async () => {
        let fail!: (value: Response) => void;
        storefront('/', (url) =>
            url.pathname === '/api/cart'
                ? response([])
                : new Promise((resolve) => {
                      fail = resolve;
                  })
        );
        expect(screen.getByText(/商品を読み込み中/)).toBeVisible();
        expect(screen.queryByRole('button', { name: '絞り込みを解除' })).toBeNull();
        fail(error('取得失敗', 500));
        await screen.findByRole('alert');
        expect(screen.queryByRole('button', { name: '絞り込みを解除' })).toBeNull();
    }
});

const productResponse: Reply = (url) =>
    url.pathname === '/api/cart'
        ? response([])
        : url.pathname.endsWith('/related')
          ? response([])
          : url.pathname === '/api/products/a'
            ? response(inStock)
            : url.pathname === '/api/products/c'
              ? response(anotherCategory)
              : url.pathname === '/api/products'
                ? response({ items: [inStock] })
                : error('商品が見つかりません。', 404);
criteria(114, {
    1: async () => {
        const fetch = storefront('/?q=リネン&category=tops', productResponse);
        await heading(inStock.name);
        expect(search()).toHaveValue('リネン');
        expect(category()).toHaveValue('tops');
        expect(pathCalls(fetch, '/api/products').at(-1)?.searchParams.get('q')).toBe('リネン');
        expect(pathCalls(fetch, '/api/products').at(-1)?.searchParams.get('category')).toBe('tops');
    },
    2: async () => {
        const user = userEvent.setup();
        storefront('/', productResponse);
        await user.type(search(), 'シャツ');
        await user.selectOptions(category(), 'tops');
        const query = new URL(url()!, location.origin).searchParams;
        expect(query.get('q')).toBe('シャツ');
        expect(query.get('category')).toBe('tops');
    },
    3: async () => {
        const user = userEvent.setup();
        storefront('/', productResponse);
        await user.selectOptions(category(), 'tops');
        await user.type(search(), 'シャツ');
        await user.click(await screen.findByRole('link', { name: new RegExp(inStock.name) }));
        await heading(inStock.name);
        await user.click(await screen.findByRole('link', { name: '商品一覧へ' }));
        expect(search()).toHaveValue('シャツ');
        expect(category()).toHaveValue('tops');
    }
});

function cards(...stocks: number[]) {
    render(
        <MemoryRouter>
            {stocks.map((stock) => (
                <ProductCard key={stock} product={product('stock-' + stock, 900, stock)} />
            ))}
        </MemoryRouter>
    );
    return screen.getAllByRole('article').map((article) => within(article));
}
criteria(121, {
    1: () => cards(1, 3).forEach((card) => expect(card.getByText('残りわずか')).toBeVisible()),
    2: () => cards(0, 4).forEach((card) => expect(card.queryByText('残りわずか')).toBeNull()),
    3: () => {
        const [empty, ready] = cards(0, 3);
        expect(empty.getByText('在庫切れ')).toBeVisible();
        expect(ready.getByText('在庫あり')).toBeVisible();
        expect(ready.getByRole('link')).toHaveAttribute('href', '/products/stock-3');
    }
});

async function stockToggle() {
    const user = userEvent.setup();
    storefront('/', (url) => (url.pathname === '/api/cart' ? response([]) : response({ items: [inStock, soldOut] })));
    await heading(soldOut.name);
    return { user, toggle: screen.getByRole('checkbox', { name: '在庫ありのみ' }) };
}
criteria(122, {
    1: async () => {
        const { user, toggle } = await stockToggle();
        await user.click(toggle);
        expect(await heading(inStock.name)).toBeVisible();
        expect(screen.queryByRole('heading', { name: soldOut.name })).toBeNull();
    },
    2: async () => {
        const { user, toggle } = await stockToggle();
        await user.click(toggle);
        expect(screen.queryByRole('heading', { name: soldOut.name })).toBeNull();
        await user.click(toggle);
        expect(await heading(soldOut.name)).toBeVisible();
    },
    3: async () => {
        const { user, toggle } = await stockToggle();
        await user.click(toggle);
        expect(screen.getByText('1 点')).toBeVisible();
        await user.click(toggle);
        expect(screen.getByText('2 点')).toBeVisible();
    }
});

criteria(123, {
    1: async () => {
        storefront('/products/a', productResponse);
        expect(await screen.findByText(/商品コード\s*[:：]\s*a$/)).toBeVisible();
    },
    2: async () => {
        storefront('/products/c', productResponse);
        expect(await heading(anotherCategory.name)).toBeVisible();
        const code = await screen.findByText(/商品コード\s*[:：]\s*c$/);
        expect(code).toBeVisible();
        expect(screen.getByText('小物')).toBeVisible();
    },
    3: async () => {
        storefront('/products/missing', productResponse);
        expect(await screen.findByRole('alert')).toHaveTextContent('商品が見つかりません。');
        expect(screen.queryByText(/商品コード/)).toBeNull();
    }
});

async function copyProduct(denied = false) {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    if (denied) writeText.mockRejectedValue(new Error('denied'));
    else writeText.mockResolvedValue(undefined);
    network(productResponse);
    window.history.replaceState(null, '', '/products/a');
    render(
        <BrowserRouter>
            <CartProvider>
                <Routes>
                    <Route path="/products/:id" element={detail} />
                </Routes>
            </CartProvider>
        </BrowserRouter>
    );
    await heading(inStock.name);
    await user.click(await exactButton('商品リンクをコピー'));
    return writeText;
}
criteria(124, {
    1: async () => {
        const writeText = await copyProduct();
        expect(writeText).toHaveBeenCalledWith(location.origin + '/products/a');
    },
    2: async () => {
        await copyProduct();
        expect(await screen.findByRole('status')).toHaveTextContent('コピーしました');
    },
    3: async () => {
        await copyProduct(true);
        expect(await screen.findByRole('alert')).toHaveTextContent('コピーできませんでした');
    }
});

async function cartView(initial: number, reject = false) {
    const user = userEvent.setup();
    let quantity = initial;
    const fetch = network((url, init) => {
        if (url.pathname === '/api/cart/a' && init.method === 'PUT') {
            if (reject) return error('保存できませんでした');
            ({ quantity } = JSON.parse(String(init.body)));
            return response({ quantity });
        }
        return response([{ productId: inStock.id, product: inStock, quantity }]);
    });
    render(
        <MemoryRouter initialEntries={['/cart']}>
            <CartProvider>
                <Cart />
            </CartProvider>
        </MemoryRouter>
    );
    await screen.findByRole('link', { name: inStock.name });
    return { user, fetch };
}
const add = () => exactButton(inStock.name + 'の数量を増やす');
const subtract = () => exactButton(inStock.name + 'の数量を減らす');
criteria(107, {
    1: async () => {
        const { user, fetch } = await cartView(2);
        await user.click(await add());
        await waitFor(() =>
            expect(fetch).toHaveBeenCalledWith(
                '/api/cart/a',
                expect.objectContaining({ method: 'PUT', body: JSON.stringify({ quantity: 3 }) })
            )
        );
        await waitFor(() => expect(screen.getByRole('spinbutton', { name: '数量' })).toHaveValue(3));
        expect(screen.getAllByText(/7,500/)[0]).toBeVisible();
    },
    2: async () => {
        const { user } = await cartView(2);
        await user.click(await subtract());
        await waitFor(() => {
            expect(screen.getByRole('spinbutton', { name: '数量' })).toHaveValue(1);
            expect(screen.getByRole('button', { name: inStock.name + 'の数量を減らす' })).toBeDisabled();
        });
    },
    3: async () => {
        const { user } = await cartView(2, true);
        await user.click(await add());
        expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした');
        expect(screen.getByRole('spinbutton', { name: '数量' })).toHaveValue(2);
        expect(screen.getAllByText(/5,000/)[0]).toBeVisible();
    }
});

function fixtureOrder(id: string, status: 'SHIPPED' | 'PLACED') {
    return {
        id,
        status,
        total: 1000,
        createdAt: '2026-11-20T09:30:00Z',
        user: { name: '購入者 ' + id, email: 'support@example.test' },
        items: [{ id: 'item-' + id, name: id + 'の商品', quantity: 1, unitPrice: 1000 }]
    };
}
const placed = fixtureOrder('placed-A', 'PLACED');
const shipped = fixtureOrder('shipped-B', 'SHIPPED');
async function historyView() {
    const user = userEvent.setup();
    const fetch = network((url) => {
        const status = url.searchParams.get('status');
        const number = url.searchParams.get('number') ?? '';
        return response(
            [placed, shipped].filter((order) => (!status || order.status === status) && order.id.includes(number))
        );
    });
    render(
        <MemoryRouter>
            <Orders />
        </MemoryRouter>
    );
    await screen.findByText(/placed-Aの商品/);
    return { user, fetch };
}
criteria(109, {
    2: async () => {
        const { user, fetch } = await historyView();
        await user.selectOptions(screen.getByRole('combobox', { name: '発送状況' }), 'SHIPPED');
        await waitFor(() => expect(pathCalls(fetch, '/api/orders').at(-1)?.searchParams.get('status')).toBe('SHIPPED'));
        expect(await screen.findByText(/shipped-Bの商品/)).toBeVisible();
        expect(screen.queryByText(/placed-Aの商品/)).toBeNull();
    },
    3: async () => {
        const { user, fetch } = await historyView();
        const status = screen.getByRole('combobox', { name: '発送状況' });
        await user.selectOptions(status, 'SHIPPED');
        await user.selectOptions(status, within(status).getByRole('option', { name: 'すべて' }));
        await waitFor(() => expect(pathCalls(fetch, '/api/orders').at(-1)?.searchParams.has('status')).toBe(false));
        expect(await screen.findByText(/placed-Aの商品/)).toBeVisible();
        expect(screen.getByText(/shipped-Bの商品/)).toBeVisible();
    }
});

criteria(117, {
    3: async () => {
        await cartView(1);
        expect(screen.getByText('商品小計')).toBeVisible();
        expect(screen.getByText('送料')).toBeVisible();
        expect(screen.getByText(/3,000/)).toBeVisible();
    }
});

function management(path: string, page: React.ReactNode, reply: Reply) {
    const fetch = network(reply);
    render(
        <MemoryRouter initialEntries={[path]}>
            <Location />
            <Routes>
                <Route element={<Outlet context="admin-token" />}>
                    <Route path="*" element={page} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
    return fetch;
}
criteria(118, {
    1: async () => {
        management('/orders?status=PLACED', <ManageOrders />, () => response([placed, shipped]));
        expect(await screen.findByText(placed.id, { exact: true })).toBeVisible();
        expect(screen.queryByText(shipped.id, { exact: true })).toBeNull();
    },
    2: async () => {
        const user = userEvent.setup();
        management('/orders?status=PLACED', <ManageOrders />, () => response([placed, shipped]));
        await user.selectOptions(screen.getByRole('combobox', { name: 'ステータス' }), 'SHIPPED');
        expect(url()).toBe('/orders?status=SHIPPED');
        expect(await screen.findByText(shipped.id, { exact: true })).toBeVisible();
    },
    3: async () => {
        const user = userEvent.setup();
        management('/orders?status=PLACED&q=placed', <ManageOrders />, () => response([placed, shipped]));
        const status = screen.getByRole('combobox', { name: 'ステータス' });
        await user.selectOptions(status, within(status).getByRole('option', { name: 'すべて' }));
        expect(url()).toBe('/orders?q=placed');
        expect(screen.getByRole('searchbox', { name: '受注を検索' })).toHaveValue('placed');
    }
});

async function pages() {
    const user = userEvent.setup();
    const fetch = storefront('/', (url) => {
        if (url.pathname === '/api/cart') return response([]);
        const page = Number(url.searchParams.get('page') ?? '1');
        return response({ items: [page === 1 ? inStock : soldOut], page, limit: 1, total: 2 });
    });
    await heading(inStock.name);
    return { user, fetch };
}
criteria(131, {
    1: async () => {
        const { user, fetch } = await pages();
        await user.click(await exactButton('次のページ'));
        expect(await heading(soldOut.name)).toBeVisible();
        expect(pathCalls(fetch, '/api/products').at(-1)?.searchParams.get('page')).toBe('2');
    },
    2: async () => {
        const { user } = await pages();
        expect(await exactButton('前のページ')).toBeDisabled();
        await user.click(await exactButton('次のページ'));
        await heading(soldOut.name);
        expect(await exactButton('次のページ')).toBeDisabled();
    },
    3: async () => {
        const { user, fetch } = await pages();
        await user.click(await exactButton('次のページ'));
        await heading(soldOut.name);
        await user.type(search(), 'シャツ');
        expect(await heading(inStock.name)).toBeVisible();
        const params = pathCalls(fetch, '/api/products').at(-1)?.searchParams;
        expect(params?.get('q')).toBe('シャツ');
        expect(params?.get('page') ?? '1').toBe('1');
    }
});

function adminDashboard(reject = false) {
    return management('/', <Dashboard />, (url) =>
        url.pathname === '/api/admin/inventory/summary'
            ? reject
                ? error('接続エラー', 500)
                : response({ totalProducts: 23, outOfStock: 2, lowStock: 11 })
            : response([])
    );
}
criteria(132, {
    1: async () => {
        const fetch = adminDashboard();
        await waitFor(() => {
            const call = fetch.mock.calls.find(([input]) => input === '/api/admin/inventory/summary');
            expect(new Headers(call?.[1]?.headers).get('Authorization')).toBe('Bearer admin-token');
        });
    },
    2: async () => {
        adminDashboard();
        expect(await screen.findByText('低在庫の商品')).toBeVisible();
        expect(await screen.findByText(/\b11\s*(件|商品)/)).toBeVisible();
    },
    3: async () => {
        adminDashboard(true);
        expect(await screen.findByText(/在庫集計を取得できませんでした/)).toBeVisible();
    }
});

criteria(133, {
    1: async () => {
        const fetch = storefront('/products/a', productResponse);
        await heading(inStock.name);
        await waitFor(() => expect(pathCalls(fetch, '/api/products/a/related')).not.toHaveLength(0));
    },
    2: async () => {
        storefront('/products/a', (url, init) =>
            url.pathname.endsWith('/related') ? response([anotherCategory]) : productResponse(url, init)
        );
        const region = await screen.findByRole('region', { name: '関連商品' });
        expect(within(region).getByRole('link', { name: new RegExp(anotherCategory.name) })).toHaveAttribute(
            'href',
            '/products/c'
        );
    },
    3: async () => {
        const fetch = storefront('/products/a', (url, init) =>
            url.pathname.endsWith('/related')
                ? error('関連商品を取得できませんでした', 500)
                : productResponse(url, init)
        );
        await waitFor(() => expect(pathCalls(fetch, '/api/products/a/related')).not.toHaveLength(0));
        expect(await heading(inStock.name)).toBeVisible();
        expect(await screen.findByText(/在庫 7 点/)).toBeVisible();
    }
});

async function confirm(reply: Reply) {
    const user = userEvent.setup();
    const fetch = network(reply);
    const review = { items: [], total: 500, shippingAddress: address, checkoutId, version: 'v1' };
    render(
        <MemoryRouter initialEntries={['/checkout/confirm']}>
            <CartProvider>
                <Location />
                <Routes>
                    <Route path="/checkout" element={<Outlet context={{ token: session.token, review }} />}>
                        <Route path="confirm" element={<CheckoutConfirm />} />
                        <Route path="complete/:id" element={<h1>注文完了</h1>} />
                    </Route>
                    <Route path="/cart" element={<h1>カート</h1>} />
                </Routes>
            </CartProvider>
        </MemoryRouter>
    );
    await user.click(await exactButton('注文を確定する'));
    return fetch;
}
const unavailable: Reply = (url) =>
    url.pathname === '/api/orders'
        ? Response.json(
              { message: '在庫が不足しています。', code: 'INSUFFICIENT_STOCK', productIds: [inStock.id] },
              { status: 409 }
          )
        : response([]);
criteria(134, {
    1: async () => {
        await confirm(unavailable);
        expect(await screen.findByRole('alert')).toHaveTextContent('在庫が不足しています。');
    },
    2: async () => {
        await confirm(unavailable);
        const alert = await screen.findByRole('alert');
        expect(within(alert).getByRole('link', { name: 'カートを確認する' })).toHaveAttribute('href', '/cart');
    },
    3: async () => {
        const fetch = await confirm((url) =>
            url.pathname === '/api/orders' ? response({ id: checkoutId }) : response([])
        );
        expect(await heading('注文完了')).toBeVisible();
        expect(url()).toBe('/checkout/complete/' + checkoutId);
        expect(pathCalls(fetch, '/api/orders')).toHaveLength(1);
    }
});

criteria(135, {
    3: async () => {
        const { user, fetch } = await historyView();
        await user.type(screen.getByRole('searchbox', { name: '注文番号' }), 'shipped');
        await waitFor(() => expect(pathCalls(fetch, '/api/orders').at(-1)?.searchParams.get('number')).toBe('shipped'));
        expect(await screen.findByText(/shipped-Bの商品/)).toBeVisible();
        expect(screen.queryByText(/placed-Aの商品/)).toBeNull();
    }
});

function reopenCheckout(reply: Reply) {
    const fetch = network(reply);
    render(
        <MemoryRouter initialEntries={['/checkout']}>
            <CartProvider>
                <Location />
                <Routes>
                    <Route path="/checkout" element={<CheckoutFlow />}>
                        <Route
                            index
                            element={
                                <>
                                    <h1>配送先</h1>
                                    <Link to="/orders">注文履歴</Link>
                                </>
                            }
                        />
                        <Route path="complete/:id" element={<h1>注文完了</h1>} />
                    </Route>
                </Routes>
            </CartProvider>
        </MemoryRouter>
    );
    return fetch;
}
const pendingKey = 'thread:pending-checkout';
criteria(112, {
    1: async () => {
        let pendingAtSend: string | null = null;
        await confirm((url) => {
            if (url.pathname !== '/api/orders') return response([]);
            pendingAtSend = sessionStorage.getItem(pendingKey);
            return Promise.reject(new Error('接続断'));
        });
        await screen.findByRole('alert');
        expect(pendingAtSend).toBe(checkoutId);
    },
    2: async () => {
        sessionStorage.setItem(pendingKey, checkoutId);
        const fetch = reopenCheckout((url) =>
            url.pathname === '/api/orders/' + checkoutId ? response({ id: checkoutId }) : response([])
        );
        expect(await heading('注文完了')).toBeVisible();
        expect(pathCalls(fetch, '/api/orders/' + checkoutId)).toHaveLength(1);
        expect(url()).toBe('/checkout/complete/' + checkoutId);
    },
    3: async () => {
        sessionStorage.setItem(pendingKey, checkoutId);
        const fetch = reopenCheckout((url) =>
            url.pathname === '/api/orders/' + checkoutId ? error('見つかりません', 404) : response([])
        );
        await waitFor(() => expect(pathCalls(fetch, '/api/orders/' + checkoutId)).toHaveLength(1));
        expect(await heading('配送先')).toBeVisible();
        expect(pathCalls(fetch, '/api/orders')).toHaveLength(0);
    }
});
