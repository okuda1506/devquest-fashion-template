const photos = import.meta.glob<string>('../../assets/products/*.webp', { eager: true, import: 'default' });

type Props = {
  product: { id: string; name: string };
  detail?: boolean;
};

export function ProductVisual({ product, detail = false }: Props) {
  const src = photos['../../assets/products/' + product.id + '.webp'];
  return <div className="product-visual">
    {src
      ? <img src={src} width={512} height={512} alt={detail ? product.name : ''} loading={detail ? 'eager' : 'lazy'} />
      : <span className="photo-placeholder">画像準備中</span>}
  </div>;
}
