import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { Products } from '../web/src/features/products/products';
import { product } from './fixture';

afterEach(() => vi.unstubAllGlobals());

test('DEV-102: 価格を数値で比較し、同額と標準順を維持する', async () => {
  const items = [product('A', 10000, 1), product('B', 900, 2), product('C', 2100, 5), product('D', 900, 0)];
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items })));
  render(<MemoryRouter><Products /></MemoryRouter>);
  await screen.findByRole('link', { name: /商品 A/ });
  const select = screen.getByRole('combobox', { name: '並び順' });
  const listed = () => screen.getAllByRole('link').map(link => link.getAttribute('href')?.split('/').at(-1));
  expect(listed()).toEqual(['A', 'B', 'C', 'D']);
  await userEvent.selectOptions(select, 'asc');
  expect(listed()).toEqual(['B', 'D', 'C', 'A']);
  await userEvent.selectOptions(select, 'desc');
  expect(listed()).toEqual(['A', 'C', 'B', 'D']);
  await userEvent.selectOptions(select, 'default');
  expect(listed()).toEqual(['A', 'B', 'C', 'D']);
});
