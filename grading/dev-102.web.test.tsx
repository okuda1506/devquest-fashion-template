import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { Products } from '../web/src/features/products/products';
import { product } from './fixture';

afterEach(() => vi.unstubAllGlobals());

async function catalog() {
    const items = [product('A', 10000, 1), product('B', 900, 2), product('C', 2100, 5), product('D', 900, 0)];
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ items }))
    );
    render(
        <MemoryRouter>
            <Products />
        </MemoryRouter>
    );
    await screen.findByRole('link', { name: /商品 A/ });
    const select = screen.getByRole('combobox', { name: '並び順' });
    const listed = () => screen.getAllByRole('link').map((link) => link.getAttribute('href')?.split('/').at(-1));
    const prices = () => listed().map((id) => items.find((item) => item.id === id)?.price);
    return { select, listed, prices };
}

test('criterion-1: 数値順で昇順・降順', async () => {
    const { select, prices } = await catalog();
    await userEvent.selectOptions(select, 'asc');
    expect(prices()).toEqual([900, 900, 2100, 10000]);
    await userEvent.selectOptions(select, 'desc');
    expect(prices()).toEqual([10000, 2100, 900, 900]);
});

test('criterion-2: 同額商品の順序', async () => {
    const { select, listed } = await catalog();
    for (const order of ['asc', 'desc']) {
        await userEvent.selectOptions(select, order);
        expect(listed().filter((id) => id === 'B' || id === 'D')).toEqual(['B', 'D']);
    }
});

test('criterion-3: 標準順に戻す', async () => {
    const { select, listed } = await catalog();
    expect(listed()).toEqual(['A', 'B', 'C', 'D']);
    await userEvent.selectOptions(select, 'desc');
    await userEvent.selectOptions(select, 'default');
    expect(listed()).toEqual(['A', 'B', 'C', 'D']);
});
