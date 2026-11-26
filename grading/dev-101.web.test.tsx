import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { ProductCard } from '../web/src/features/products/product-card';
import { product } from './fixture';

function card(stock: number) {
    render(
        <MemoryRouter>
            <ProductCard product={product('in', 900, stock)} />
        </MemoryRouter>
    );
    return within(screen.getByRole('article'));
}

test('criterion-1: 在庫あり', () => {
    expect(card(1).getByText('在庫あり')).toBeVisible();
});

test('criterion-2: 在庫切れ', () => {
    expect(card(0).getByText('在庫切れ')).toBeVisible();
});

test('criterion-3: 商品名・価格・リンク', () => {
    const view = card(1);
    expect(view.getByRole('heading', { name: '商品 in' })).toBeVisible();
    expect(view.getByText(/900/)).toBeVisible();
    expect(view.getByRole('link', { name: /商品 in/ })).toHaveAttribute('href', '/products/in');
});
