export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  }).catch(() => { throw new Error('API に接続できませんでした。'); });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : '処理に失敗しました。');
  return body as T;
}

export const yen = (price: number) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(price);
