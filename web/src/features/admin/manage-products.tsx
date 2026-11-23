import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { yen } from '../../api';
import { ProductVisual } from '../products/product-visual';
import { categories, type Product } from '../products/products';
import { AdminFeedback } from './admin-feedback';
import { useAdminList } from './admin-data';

type ProductFields = Pick<Product, 'name' | 'description' | 'category' | 'price' | 'isPublished'>;

function ProductForm({ product, busy, close, save }: {
  product?: Product; busy: boolean; close: () => void;
  save: (fields: ProductFields, stock: number) => Promise<boolean>;
}) {
  const name = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { name.current?.focus(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name')).trim();
    if (!name) { setError('商品名を入力してください。'); return; }
    setError('');
    await save({
      name,
      description: String(form.get('description')),
      category: String(form.get('category')),
      price: Number(form.get('price')),
      isPublished: form.get('isPublished') === 'true',
    }, Number(form.get('stock') ?? 0));
  }

  return <form className="product-editor" onSubmit={submit} aria-labelledby="product-edit-title">
    <h3 id="product-edit-title">{product ? '商品を編集' : '商品を新規登録'}</h3>
    <fieldset className="admin-fields" disabled={busy}>
      <label className="full-width">商品名
        <input required name="name" ref={name} maxLength={100} defaultValue={product?.name} />
      </label>
      <label>カテゴリー
        <select name="category" defaultValue={product?.category ?? 'tops'}>
          {Object.entries(categories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label>販売価格（円）
        <input required name="price" type="number" min={0} max={1000000} defaultValue={product?.price} />
      </label>
      <label>公開状態
        <select name="isPublished" defaultValue={String(product?.isPublished ?? false)}>
          <option value="false">非公開</option><option value="true">公開</option>
        </select>
      </label>
      {!product && <label>初期在庫数
        <input required name="stock" type="number" min={0} max={100000} defaultValue={0} />
      </label>}
      <label className="full-width">商品説明
        <textarea name="description" maxLength={2000} rows={4} defaultValue={product?.description} />
      </label>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="admin-actions">
      <button type="submit" disabled={busy}>{product ? '変更を保存' : '商品を登録'}</button>
      <button type="button" className="admin-secondary" disabled={busy} onClick={close}>閉じる</button>
    </div>
  </form>;
}

export function ManageProducts({ token, inventory }: { token: string; inventory: boolean }) {
  const data = useAdminList<Product>('/admin/products', token);
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const keyword = query.trim().toLowerCase();
  const visible = data.items.filter(product => {
    const searchText = [product.name, product.id, categories[product.category]].join(' ').toLowerCase();
    return searchText.includes(keyword) && (stockFilter === 'all' || product.stock === 0);
  });
  const locked = data.saving || data.loading;

  async function saveProduct(fields: ProductFields, stock: number) {
    if (editor === null) return false;
    if (editor === 'new') {
      const success = await data.save('/admin/products', 'POST', { ...fields, stock }, '商品を登録しました。');
      if (success) { setEditor(null); setQuery(''); }
      return success;
    }

    // 変更した項目のみ送信し、別画面で編集された他の項目を上書きしない。
    const changed = Object.fromEntries(
      (Object.keys(fields) as Array<keyof ProductFields>)
        .filter(key => fields[key] !== editor[key])
        .map(key => [key, fields[key]]),
    );
    if (Object.keys(changed).length === 0) { setEditor(null); return true; }
    const success = await data.save('/admin/products/' + encodeURIComponent(editor.id), 'PATCH', changed, '商品情報を保存しました。');
    if (success) setEditor(null);
    return success;
  }

  function updateStock(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault();
    const stock = Number(new FormData(event.currentTarget).get('stock'));
    void data.save('/admin/inventory/' + encodeURIComponent(product.id), 'PATCH',
      { stock, expectedStock: product.stock }, '在庫数を保存しました。');
  }

  return <section aria-labelledby="admin-products-title">
    <h2 id="admin-products-title">{inventory ? '在庫一覧' : '商品一覧'}</h2>
    <div className="admin-toolbar">
      <label>商品を検索<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="商品名・商品ID・カテゴリー" /></label>
      {inventory && <label>在庫状況<select value={stockFilter} onChange={event => setStockFilter(event.target.value)}>
        <option value="all">すべて</option><option value="out">在庫切れのみ</option>
      </select></label>}
      <div className="admin-actions">
        <button type="button" className="admin-secondary" disabled={locked} onClick={data.refresh}>
          <RefreshCw size={15} aria-hidden="true" /> 一覧を更新
        </button>
        {!inventory && <button type="button" disabled={locked} onClick={() => setEditor('new')}>
          <Plus size={16} aria-hidden="true" /> 新規登録
        </button>}
      </div>
    </div>
    {editor && <ProductForm key={editor === 'new' ? 'new' : editor.id} product={editor === 'new' ? undefined : editor}
      save={saveProduct} busy={locked} close={() => setEditor(null)} />}
    <AdminFeedback {...data} />
    {!data.loading && !data.loadError && !visible.length && <p>該当する商品はありません。</p>}
    {!!visible.length && <ul className="admin-list">
      {visible.map(product => <li key={product.id} className="admin-item">
        <div className="admin-product">
          <ProductVisual product={product} />
          <div><h3>{product.name}</h3>
            <p>{categories[product.category]} · {yen(product.price)} · {product.isPublished ? '公開' : '非公開'}</p>
            <p className="admin-mono">{product.id}</p>
          </div>
        </div>
        {inventory ? <>
          <span className={product.stock === 0 ? 'admin-stock-out' : ''}>{product.stock === 0 ? '在庫切れ' : `現在 ${product.stock} 点`}</span>
          <form className="stock-editor" key={product.stock} onSubmit={event => updateStock(event, product)}>
            <label>在庫数 <input name="stock" className="quantity" type="number" min={0} max={100000}
              defaultValue={product.stock} disabled={locked} required /></label>
            <button className="admin-secondary" disabled={locked}>保存</button>
          </form>
        </> : <button type="button" className="admin-secondary" disabled={locked} onClick={() => setEditor(product)}>編集</button>}
      </li>)}
    </ul>}
  </section>;
}
