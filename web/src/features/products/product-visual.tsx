import type { Ref } from 'react';

const photos = import.meta.glob<string>('../../assets/products/*.webp', { eager: true, import: 'default' });

type Props = {
    product: { id: string; name: string };
    detail?: boolean;
    imageRef?: Ref<HTMLImageElement>;
};

/** 商品に対応する写真または代替ビジュアルを表示する */
export function ProductVisual({ product, detail = false, imageRef }: Props) {
    const src = photos['../../assets/products/' + product.id + '.webp'];
    return (
        <div className="product-visual">
            {src ? (
                <img
                    ref={imageRef}
                    src={src}
                    width={512}
                    height={512}
                    alt={detail ? product.name : ''}
                    loading={detail ? 'eager' : 'lazy'}
                />
            ) : (
                <span className="photo-placeholder">画像準備中</span>
            )}
        </div>
    );
}
