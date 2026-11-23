import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { Products } from '../web/src/features/products/products';
import { product } from './fixture';

afterEach(() => vi.unstubAllGlobals());

async function catalog() {
    const tee = product('T', 1000, 2);
    const jacket = product('J', 12000, 1, 'outerwear');
    let finishTops!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => {
        const category = new URL(url, 'http://thread.test').searchParams.get('category');
        if (category === 'tops')
            return new Promise<Response>((resolve) => {
                finishTops = resolve;
            });
        return Promise.resolve(Response.json({ items: category === 'outerwear' ? [jacket] : [tee, jacket] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
        <MemoryRouter>
            <Products />
        </MemoryRouter>
    );
    await screen.findByRole('link', { name: /商品 T/ });
    const select = screen.getByRole('combobox', { name: 'カテゴリー' });
    return { select, fetchMock, respondToTops: () => finishTops(Response.json({ items: [tee] })) };
}

function lastCategory(fetchMock: Awaited<ReturnType<typeof catalog>>['fetchMock']) {
    const url = fetchMock.mock.lastCall?.[0];
    return url ? new URL(url, 'http://thread.test').searchParams.get('category') : null;
}

test('criterion-1: カテゴリーを送信', async () => {
    const { select, fetchMock } = await catalog();
    await userEvent.selectOptions(select, 'outerwear');
    expect(await screen.findByRole('link', { name: /商品 J/ })).toBeVisible();
    expect(lastCategory(fetchMock)).toBe('outerwear');
    expect(screen.queryByRole('link', { name: /商品 T/ })).toBeNull();
});

test('criterion-2: 絞り込み解除', async () => {
    const { select, fetchMock } = await catalog();
    await userEvent.selectOptions(select, 'outerwear');
    await waitFor(() => expect(lastCategory(fetchMock)).toBe('outerwear'));
    await userEvent.selectOptions(select, '');
    await waitFor(() => expect(lastCategory(fetchMock)).toBeNull());
    expect(await screen.findByRole('link', { name: /商品 T/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /商品 J/ })).toBeVisible();
});

test('criterion-3: 古いレスポンスを反映しない', async () => {
    const { select, fetchMock, respondToTops } = await catalog();
    await userEvent.selectOptions(select, 'tops');
    await waitFor(() => expect(lastCategory(fetchMock)).toBe('tops'));
    await userEvent.selectOptions(select, 'outerwear');
    await screen.findByRole('link', { name: /商品 J/ });
    await act(async () => {
        respondToTops();
    });
    expect(screen.queryByRole('link', { name: /商品 T/ })).toBeNull();
    expect(screen.getByRole('link', { name: /商品 J/ })).toBeVisible();
});
