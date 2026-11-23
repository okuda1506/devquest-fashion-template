import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { Products } from '../web/src/features/products/products';
import { product } from './fixture';

afterEach(() => vi.unstubAllGlobals());

test('DEV-103: 素早くカテゴリーを変更しても最新結果を保ち、絞り込みを解除できる', async () => {
  const tee = product('T', 1000, 2);
  const jacket = product('J', 12000, 1, 'outerwear');
  let finishTops!: (response: Response) => void;
  const fetchMock = vi.fn((url: string) => {
    const category = new URL(url, 'http://thread.test').searchParams.get('category');
    if (category === 'tops') return new Promise<Response>(resolve => { finishTops = resolve; });
    return Promise.resolve(Response.json({ items: category === 'outerwear' ? [jacket] : [tee, jacket] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><Products /></MemoryRouter>);
  await screen.findByRole('link', { name: /商品 T/ });
  const select = screen.getByRole('combobox', { name: 'カテゴリー' });
  await userEvent.selectOptions(select, 'tops');
  await waitFor(() => expect(finishTops).toBeTypeOf('function'));
  await userEvent.selectOptions(select, 'outerwear');
  await screen.findByRole('link', { name: /商品 J/ });
  expect(screen.queryByRole('link', { name: /商品 T/ })).toBeNull();
  await act(async () => { finishTops(Response.json({ items: [tee] })); });
  expect(screen.queryByRole('link', { name: /商品 T/ })).toBeNull();
  await userEvent.selectOptions(select, '');
  expect(await screen.findByRole('link', { name: /商品 T/ })).toBeVisible();
});
