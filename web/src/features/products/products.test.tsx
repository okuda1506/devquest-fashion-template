import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { Products, type Product } from './products';

afterEach(() => vi.unstubAllGlobals());

test('商品一覧から商品の詳細へアクセスできる', async () => {
  const product: Product = { id: 'tee', name: '春のシャツ', stock: 4, category: 'tops', description: '', price: 2900, isPublished: true };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [product] })));
  render(<MemoryRouter><Products /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /春のシャツ/ })).toHaveAttribute('href', '/products/tee');
  expect(screen.getByText(/2,900/)).toBeVisible();
});

test('商品取得に失敗した場合は再試行できる', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('接続不可')).mockResolvedValueOnce(Response.json({ items: [] }));
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><Products /></MemoryRouter>);
  await screen.findByRole('alert');
  screen.getByRole('button', { name: '再試行' }).click();
  expect(await screen.findByText('該当する商品はありません。')).toBeVisible();
});
