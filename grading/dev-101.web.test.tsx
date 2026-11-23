import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { ProductCard } from '../web/src/features/products/products';
import { product } from './fixture';

test('DEV-101: 在庫の境界をテキストで表示し、商品詳細へ遷移できる', () => {
  render(<MemoryRouter>
    <ProductCard product={product('in', 900, 1)} />
    <ProductCard product={product('out', 14800, 0)} />
  </MemoryRouter>);
  const [first, second] = screen.getAllByRole('article');
  expect(within(first).getByText('在庫あり')).toBeVisible();
  expect(within(second).getByText('在庫切れ')).toBeVisible();
  expect(within(first).getByRole('link', { name: /商品 in/ })).toHaveAttribute('href', '/products/in');
  expect(within(first).getByText(/900/)).toBeVisible();
});
