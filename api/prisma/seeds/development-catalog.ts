const colors = [
    'ブラック', 'チャコール', 'グレー', 'アイボリー', 'ベージュ', 'サンド', 'ブラウン',
    'モカ', 'ネイビー', 'ブルー', 'オリーブ', 'セージ', 'ボルドー'
] as const;

const styles = [
    { category: 'tops', price: 3900, names: ['クルーネックTシャツ', 'ワッフルカットソー', 'ポプリンシャツ', 'スキッパーニット', 'リブタンクトップ', 'ハーフジップスウェット', 'ボートネックプルオーバー'] },
    { category: 'outerwear', price: 12900, names: ['ショートブルゾン', 'ステンカラーコート', 'ダブルジャケット', 'キルティングベスト', 'デニムジャケット', 'フーデッドパーカ'] },
    { category: 'bottoms', price: 6900, names: ['ワイドスラックス', 'ストレートデニム', 'カーゴパンツ', 'タックショーツ', 'ナロースカート', 'プリーツスカート'] },
    { category: 'dresses', price: 9800, names: ['シャツワンピース', 'キャミソールドレス', 'リブニットワンピース', 'カシュクールワンピース', 'ジャンパースカート'] },
    { category: 'bags', price: 4900, names: ['ミニショルダーバッグ', 'ボストンバッグ', 'ナイロンバックパック', 'スクエアハンドバッグ', 'ドローストリングバッグ'] },
    { category: 'shoes', price: 7900, names: ['レースアップシューズ', 'ローカットスニーカー', 'ペニーローファー', 'ストラップシューズ'] },
    { category: 'accessories', price: 1900, names: ['リブビーニー', 'レザーベルト', 'フープピアス', 'チェーンネックレス', 'フリンジストール'] }
] as const;

const models = styles.flatMap(({ category, price, names }) =>
    names.map((name, index) => ({ category, name, price: price + index * 500 }))
);

const collections = ['', 'スタジオ', 'ウィークエンド'] as const;

/**
 * 定番6件に追加する3コレクション・38型・13色の商品を固定IDで作成する
 */
export function developmentCatalog() {
    const collectionSize = models.length * colors.length;

    return collections.flatMap((collection, collectionIndex) =>
        models.flatMap(({ category, name, price }, modelIndex) =>
            colors.map((color, colorIndex) => {
                const number = collectionIndex * collectionSize + colorIndex * models.length + modelIndex + 1;
                const productName = collection ? `${collection} ${name}` : name;

                return {
                    id: `thread-catalog-${String(number).padStart(3, '0')}`,
                    category,
                    name: `${productName} / ${color}`,
                    description: `${productName}の${color}カラー。`,
                    price: price + collectionIndex * 500,
                    stock: (modelIndex * 11 + colorIndex * 7 + collectionIndex * 3) % 48,
                    isPublished: collectionIndex === 0 || number % 10 !== 0
                };
            })
        )
    );
}
